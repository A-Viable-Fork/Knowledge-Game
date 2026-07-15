// Role: the intake gate (intake data model v3, Sections 3, 5, 6, 7, 8, 9, 11). Runs the checks by
//   the link-kind routing table, computes earned grades, decides the contribution against a store
//   state, and writes the receipt. This is the sole canonical write path, absorbing the role the
//   retired Python compose-gate held: it composes independent typed contributions with no model in
//   the loop, and the decision is a deterministic function of content and the store state.
// Contract: decide(contribution, storeView, versions) -> receipt (Section 11). restatementClosure,
//   satisfiesReinstatement exported for tests. Pure, ESM; kernel imports only kernel.
// Invariant: a supports link is the only thing that enters the grade computation; depends-on routes
//   to the currency check (a fallen frame breaks form, not grade); a reference binds at the grade the
//   STORE holds for the target, never a grade the contribution asserts for someone else's entry.
"use strict";
import { earnedGrade } from "../grounding/earned-grade.mjs";
import { leqWithinMode, POSITIONS } from "../schema/confidence.mjs";
import { footprintClosure, ceilingFor, sourceClass } from "../schema/tables.mjs";
import { referenceBindingRow, wellFormednessFinding, contradictionRecord, corroborationFinding, coverageNote } from "../schema/records.mjs";
import { hashOf } from "../schema/canonical.mjs";

// union-find over restatement links: the closure treats joined identities as one claim.
export function restatementClosure(restatementPairs) {
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  for (const p of restatementPairs || []) { find(p.from_identity); find(p.to_identity); union(p.from_identity, p.to_identity); }
  return (id) => {
    find(id);
    const root = find(id);
    const out = new Set();
    for (const k of parent.keys()) if (find(k) === root) out.add(k);
    out.add(id);
    return out;
  };
}
function intersects(a, b) { for (const x of a) if (b.has(x)) return true; return false; }

// reinstatement condition satisfaction, checked mechanically against the typed fields (Section 7).
export function satisfiesReinstatement(cond, ctx) {
  const { entries, links, storeView, earnedOf } = ctx;
  if (cond.condition_kind === "entry-of-kind") {
    const ok = entries.some((e) => e.kind === cond.required_kind && (!cond.target_identity || e.identity === cond.target_identity));
    return { ok, field: ok ? null : "required_kind" };
  }
  if (cond.condition_kind === "entry-at-grade") {
    const present = entries.some((e) => e.identity === cond.target_identity) || storeView.earnedByIdentity.has(cond.target_identity);
    if (!present) return { ok: false, field: "target_identity" };
    const earned = earnedOf(cond.target_identity);
    const cmp = leqWithinMode(cond.minimum_grade, earned);
    return { ok: cmp.comparable && cmp.leq, field: cmp.comparable && cmp.leq ? null : "minimum_grade" };
  }
  if (cond.condition_kind === "citation-into-class") {
    const ok = [...entries, ...links].some((r) => sourceClass(storeView.sourceTable, r.source_id) === cond.required_source_class);
    return { ok, field: ok ? null : "required_source_class" };
  }
  return { ok: false, field: "condition_kind" };
}

// The certificate seal (CERT-1): a derived hash over the grounded-claim certificate bundle. Computed
// downstream of grounding, never an input to it, so earnedGrade and the earned-grade recurrence are
// untouched (design rule 1); derived and reproducible, not stored (design rule 2). The bundle is
// exactly the certifying content: the claim identities and their grades, the bindings, the checking
// records in play, the state verified against, and the ruleset, schema, and contribution it was
// decided under. Volatile and presentation-only fields (findings, the decision label, the closures and
// matches) are excluded, so the same certified assembly always seals identically; canonicalize sorts
// the sets, so the seal is order-independent and byte-stable, headless or in-browser.
// GROUNDED thm.certificate-seals-bundle: the seal is a function of the bundle, changing if and only if a
// bundled part changes and reproducing for an identical assembly, grounded in the math kernel at the
// checked tier by the seal oracle (build/check-certificate.mjs).
export function certificateSeal({ rulesetVersion, schemaVersion, storeView, contribution, gradeTable, bindingTable, entries }) {
  return hashOf({
    ruleset_version: rulesetVersion, schema_version: schemaVersion,
    store_state: storeView.stateHash, contribution_hash: contribution.hash,
    grade_table: gradeTable, binding_table: bindingTable,
    checking_records: entries.map((e) => ({ identity: e.identity, checking_records: e.checking_records || [] })),
  });
}

export function decide(contribution, storeView, { rulesetVersion = "v3", schemaVersion = "v3", sourceVersion = "v1" } = {}) {
  const entries = contribution.entries || [];
  const links = contribution.links || [];
  const cEntry = new Map(entries.map((e) => [e.identity, e]));
  const cLinkIds = new Set(links.map((l) => l.identity));
  const kindOf = (id) => (cEntry.has(id) ? cEntry.get(id).kind : (storeView.kindOf && storeView.kindOf.get(id)) || null);

  const findings = [];
  const bindingTable = [];
  const withdrawnMatches = [];
  const contradictionRecords = [];
  const corroborationFindings = [];
  const decisionBasis = [];
  let declined = false;
  const decline = (rule) => { declined = true; if (rule && !decisionBasis.includes(rule)) decisionBasis.push(rule); };

  // restatement closure over store + contribution
  const restPairs = [
    ...(storeView.restatementLinks || []),
    ...links.filter((l) => l.link_kind === "restatement").map((l) => ({ from_identity: l.from_identity, to_identity: l.to_identity })),
  ];
  const closureOf = restatementClosure(restPairs);

  // ---- earned grades (Section 9). Supports into any closure member support the merged claim ----
  const egFull = new Map();
  const cache = new Map();
  function earnedOf(id) {
    if (cache.has(id)) return cache.get(id);
    if (storeView.earnedByIdentity.has(id)) { const g = storeView.earnedByIdentity.get(id).earned; cache.set(id, g); return g; }
    const e = cEntry.get(id);
    if (!e) { cache.set(id, "ungraded"); return "ungraded"; }
    cache.set(id, "asserted"); // cycle guard. GROUNDED thm.cycle-guard: an in-cycle node resolves to asserted so the resolution terminates (build/check-math-differential.mjs)
    const members = closureOf(id);
    const supports = links.filter((l) => l.link_kind === "supports" && members.has(l.to_identity)).map((l) => ({
      group: l.support_group, linkGrade: l.declared_grade, supportEarned: earnedOf(l.from_identity),
      footprint: footprintClosure(storeView.sourceTable, [l.source_id]), linkIdentity: l.identity,
    }));
    const ceil = ceilingFor(storeView.kindTable, e.kind);
    const eg = earnedGrade({ ceiling: ceil ? ceil.position : "asserted", constitutive: !!(ceil && ceil.mode === "constitutive"), checkingRecords: e.checking_records, supports });
    cache.set(id, eg.earned); egFull.set(id, eg);
    return eg.earned;
  }

  // ---- binding rows (Section 5): every identity a link names binds at the stored grade ----
  for (const l of links) {
    for (const [fp, id] of [["from_identity", l.from_identity], ["to_identity", l.to_identity]]) {
      const locator = l.identity + "#" + fp;
      if (storeView.earnedByIdentity.has(id)) {
        const st = storeView.earnedByIdentity.get(id);
        const resolution = st.inForce ? "bound" : "bound-superseded";
        bindingTable.push(referenceBindingRow({ reference_locator: locator, target_identity: id, resolution, bound_state: storeView.stateHash, stored_grade: st.earned }));
        if (!st.inForce) { // Boundary 1: default declines, naming the successor
          findings.push(wellFormednessFinding({ contribution_hash: contribution.hash, entry_locator: l.identity, field_path: fp, rule_id: "WF-SUPERSEDED", expected: "a reference to an in-force entry", found: id }));
          decline("WF-SUPERSEDED");
        }
      } else if (cEntry.has(id) || cLinkIds.has(id)) {
        bindingTable.push(referenceBindingRow({ reference_locator: locator, target_identity: id, resolution: "unresolved" })); // resolves against a same-contribution sibling
      } else {
        bindingTable.push(referenceBindingRow({ reference_locator: locator, target_identity: id, resolution: "unresolved" }));
        findings.push(wellFormednessFinding({ contribution_hash: contribution.hash, entry_locator: l.identity, field_path: fp, rule_id: "WF-UNRESOLVED", expected: "a resolvable identity", found: id }));
        decline("WF-UNRESOLVED");
      }
    }
  }

  // ---- currency check (Section 3): depends-on target must exist and be in force ----
  for (const l of links.filter((l) => l.link_kind === "depends-on")) {
    const t = l.to_identity;
    const inForce = (storeView.earnedByIdentity.get(t) && storeView.earnedByIdentity.get(t).inForce) || cEntry.has(t);
    if (!inForce) {
      findings.push(wellFormednessFinding({ contribution_hash: contribution.hash, entry_locator: l.identity, field_path: "to_identity", rule_id: "WF-DEPENDS", expected: "an in-force depended-on entry", found: t }));
      decline("WF-DEPENDS");
    }
  }

  // ---- grade-mode check (Section 9): declared vs earned within mode ----
  const gradeTable = [];
  for (const e of entries) {
    earnedOf(e.identity);
    const eg = egFull.get(e.identity) || { earned: "asserted", mode: null, S: "asserted", B: "none" };
    const ceil = ceilingFor(storeView.kindTable, e.kind);
    gradeTable.push({ identity: e.identity, ceiling: ceil ? ceil.position : null, ceiling_mode: ceil ? ceil.mode : null, declared_grade: e.declared_grade, earned_grade: eg.earned, earned_mode: eg.mode, S: eg.S, B: eg.B });
    const cmp = leqWithinMode(e.declared_grade, eg.earned);
    if (!cmp.comparable) {
      findings.push(wellFormednessFinding({ contribution_hash: contribution.hash, entry_locator: e.identity, field_path: "declared_grade", rule_id: "GM-MODE", expected: `a grade whose mode the basis can provide (earned ${eg.earned})`, found: e.declared_grade }));
      decline("GM-MODE");
    } else if (!cmp.leq) {
      findings.push(wellFormednessFinding({ contribution_hash: contribution.hash, entry_locator: e.identity, field_path: "declared_grade", rule_id: "GM-ABOVE", expected: `at or below the earned grade ${eg.earned}`, found: e.declared_grade }));
      decline("GM-ABOVE");
    }
  }

  // ---- withdrawn-claim check over the restatement closure (Section 7) ----
  const ctx = { entries, links, storeView, earnedOf };
  for (const e of entries) {
    const members = closureOf(e.identity);
    for (const w of storeView.withdrawnRecords || []) {
      if (intersects(members, closureOf(w.claim_identity))) {
        const sat = satisfiesReinstatement(w.reinstatement_condition, ctx);
        withdrawnMatches.push({ withdrawal: w.claim_identity, reintroduced_as: e.identity, satisfaction: sat.ok ? "satisfied" : "unsatisfied", failing_condition_field: sat.field });
        if (!sat.ok) decline("WD-UNSATISFIED");
      }
    }
  }

  // ---- corroboration & independence (Section 8): a claim supported by >1 contributor. Judged over
  //      ALL supports into the claim's closure, the store's and this contribution's, deduped by id ----
  const allSupportLinks = [...links, ...(storeView.links || [])];
  const seenSup = new Set();
  const dedupSup = allSupportLinks.filter((l) => l.link_kind === "supports" && !seenSup.has(l.identity) && seenSup.add(l.identity));
  // the claims this contribution touches: its own entries, and any claim it adds a support into
  const touched = new Set([...entries.map((e) => e.identity), ...links.filter((l) => l.link_kind === "supports").map((l) => l.to_identity)]);
  for (const cid of touched) {
    const members = closureOf(cid);
    const supLinks = dedupSup.filter((l) => members.has(l.to_identity));
    const contributors = new Set(supLinks.map((l) => l.contributor_id));
    if (contributors.size >= 2) {
      const groups = new Map();
      for (const l of supLinks) { const g = l.support_group || l.identity; if (!groups.has(g)) groups.set(g, new Set()); for (const s of footprintClosure(storeView.sourceTable, [l.source_id])) groups.get(g).add(s); }
      const gkeys = [...groups.keys()];
      let disjointPair = false, shared = new Set();
      for (let i = 0; i < gkeys.length; i++) for (let j = i + 1; j < gkeys.length; j++) {
        const inter = [...groups.get(gkeys[i])].filter((s) => groups.get(gkeys[j]).has(s));
        if (inter.length === 0) disjointPair = true; else inter.forEach((s) => shared.add(s));
      }
      const verdict = disjointPair ? "disjoint" : "shared";
      corroborationFindings.push(corroborationFinding({
        identity: [...members].sort()[0], closure_members: [...members].sort(),
        support_groups: gkeys.map((g) => ({ group: String(g), footprint: [...groups.get(g)].sort() })),
        verdict, effective_count: disjointPair ? gkeys.length : 1,
        shared_source_ids: verdict === "shared" ? [...shared].sort() : undefined,
        disjoint_footprints: verdict === "disjoint" ? gkeys.map((g) => [...groups.get(g)].sort()) : undefined,
        coverage_note: coverageNote(sourceVersion),
      }));
    }
  }

  // ---- contradiction records (Section 6) ----
  for (const l of links.filter((l) => l.link_kind === "contradicts")) {
    const aSup = new Set(links.filter((x) => x.link_kind === "supports" && x.to_identity === l.from_identity).map((x) => x.from_identity));
    const bSup = new Set(links.filter((x) => x.link_kind === "supports" && x.to_identity === l.to_identity).map((x) => x.from_identity));
    const dp = [];
    for (const s of aSup) if (!bSup.has(s)) dp.push({ point_identity: s, present_in: "a-only", group_context: "absent" });
    for (const s of bSup) if (!aSup.has(s)) dp.push({ point_identity: s, present_in: "b-only", group_context: "absent" });
    contradictionRecords.push(contradictionRecord({ identity_a: l.from_identity, identity_b: l.to_identity, link_identity: l.identity, grade_a: earnedOf(l.from_identity), grade_b: earnedOf(l.to_identity), divergence_points: dp }));
  }

  // ---- the decision ----
  let decision;
  if (declined) decision = "declined";
  else if (contradictionRecords.length > 0) { decision = "accepted-with-disagreement"; decisionBasis.push("SEC-6-contradiction"); }
  else { decision = "accepted"; decisionBasis.push("all-checks-clean"); }

  // ---- the certificate hash (CERT-1): a derived seal over the grounded-claim receipt ----
  const certificate_hash = certificateSeal({ rulesetVersion, schemaVersion, storeView, contribution, gradeTable, bindingTable, entries });

  return {
    ruleset_version: rulesetVersion, schema_version: schemaVersion,
    store_state: storeView.stateHash, contribution_hash: contribution.hash,
    findings, binding_table: bindingTable, grade_table: gradeTable,
    restatement_closures: [...new Set(entries.map((e) => [...closureOf(e.identity)].sort().join(",")))].map((s) => s.split(",")),
    withdrawn_matches: withdrawnMatches, corroboration_findings: corroborationFindings,
    contradiction_records: contradictionRecords, decision, decision_basis: decisionBasis,
    certificate_hash,
  };
}
