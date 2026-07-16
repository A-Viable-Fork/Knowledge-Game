// Role: the register-an-artifact draft path (Phase KG-12 Step 4), a distinct module from
//   api/contribute.js on purpose. draftProposal's own invariant is that a pasted citation can never
//   carry a checking_records entry (there is no field a caller sets to fabricate independent
//   confirmation from free text). An artifact-card's conformance citation is the opposite case: real
//   evidence this app (or the registrant, honestly self-attested) actually produced, which must be
//   attachable, so this module builds the claim directly through the same real schema builders and
//   gate build/seed-registry.mjs already uses for the-registry's own seed entries, rather than
//   stretching draftProposal's guarantee to make room for it.
// Contract: runOracleFor(kind, payload) -> Promise<{pass, detail, method, methodClass, independence}>
//   for the sandbox-executable kinds (SANDBOX_EXECUTABLE_KINDS); throws for any other kind. payload
//   is {source, shape} for "extension", {variants} for "skin", {communityMeta} (one of this app's own
//   already-declared COMMUNITIES entries, never an arbitrary URL) for "community". draftRegistryArtifact
//   (community, draft) -> {proposal, receipt}: community is a registry community's fetchCommunity()
//   result; draft = {statement, kind, contributorId?, declaredGrade?, sourceId?, artifactHash?,
//   contractIdentity?, interfaceIdentity?, requiredOracle?, ceilingStatement?, checkingRecords?}.
//   checkingRecords, when present, must already be real (built from runOracleFor's own result or an
//   honestly self-attested CI-only note), never invented by this module.
// Invariant: this module fabricates no checking_records itself; every one it writes into a claim
//   arrives already-built on draft.checkingRecords, sourced from an actual runOracleFor() call or an
//   explicit self-attestation the caller assembled. A CI-only kind never gets a "distinct-party",
//   app-verified-sounding record from here; the periphery decides that framing, this module only
//   refuses to run an oracle it does not have.
"use strict";
import { claimRecord, linkRecord } from "../vendor/kernel/schema/records.mjs";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";
import { checkConformance } from "./extension.js";
import { checkSkinConformance } from "./skin-conformance.js";
import { fetchCommunity } from "./community.js";

export const SANDBOX_EXECUTABLE_KINDS = new Set(["extension", "skin", "community"]);
export const CI_ONLY_KINDS = new Set(["client", "component"]);

const FIXTURE_ROWS = [
  { identity: "a", kind: "measurement", statement: "s1", declared_grade: "asserted", earned_grade: "asserted", source_id: "S1" },
  { identity: "b", kind: "measurement", statement: "s2", declared_grade: "checked", earned_grade: "checked", source_id: "S2" },
];

export async function runOracleFor(kind, payload) {
  if (kind === "extension") {
    const { source, shape } = payload;
    const result = await checkConformance(source, shape, FIXTURE_ROWS, [], []);
    return {
      pass: result.pass, detail: result.pass ? `pass (shape ${shape})` : `refused: ${result.reason}`,
      method: `api/extension.js#checkConformance re-run live against the pasted candidate, shape ${shape}: pass=${result.pass}${result.reason ? `, ${result.reason}` : ""}`,
      methodClass: "direct-measurement", independence: "distinct-party",
    };
  }
  if (kind === "skin") {
    const { variants } = payload;
    const result = checkSkinConformance({ variants });
    return {
      pass: result.pass, detail: `${result.checks.length} assertions, pass=${result.pass}`,
      method: `api/skin-conformance.js#checkSkinConformance re-run live against the pasted token set: ${result.checks.length} assertions, pass=${result.pass}`,
      methodClass: "direct-measurement", independence: "distinct-party",
    };
  }
  if (kind === "community") {
    const { communityMeta } = payload;
    const fresh = await fetchCommunity(communityMeta.path);
    return {
      pass: true, detail: `hash ${fresh.snapshotHash.slice(0, 16)}... verified live`,
      method: `api/community.js#fetchCommunity re-verified live against ${communityMeta.label}: hash ${fresh.snapshotHash}`,
      methodClass: "direct-measurement", independence: "distinct-party", artifactHash: fresh.snapshotHash,
    };
  }
  throw new Error(`runOracleFor: kind '${kind}' has no sandbox-executable oracle in this app`);
}

export function draftRegistryArtifact(community, draft) {
  const raw = community.raw;
  const d = draft || {};
  if (!d.statement) throw new Error("draftRegistryArtifact: statement required");
  if (!d.kind) throw new Error("draftRegistryArtifact: kind required");
  const contributor_id = d.contributorId || "contributor";
  const source_id = d.sourceId || "S-registry-oracles";

  const rawClaim = {
    kind: d.kind, statement: d.statement, source_id, contributor_id, declared_grade: d.declaredGrade || "checked",
  };
  if (d.artifactHash) rawClaim.artifact_hash = d.artifactHash;
  if (d.contractIdentity) rawClaim.contract_hash = d.contractIdentity;
  if (d.interfaceIdentity) rawClaim.interface_identity = d.interfaceIdentity;
  if (d.requiredOracle) rawClaim.required_oracle = d.requiredOracle;
  if (d.ceilingStatement) rawClaim.ceiling_statement = d.ceilingStatement;
  if (d.checkingRecords && d.checkingRecords.length) rawClaim.checking_records = d.checkingRecords;

  let claim;
  try {
    claim = claimRecord(rawClaim);
  } catch (e) {
    return { proposal: null, receipt: { decision: "declined", error: "malformed claim: " + e.message, findings: [], grade_table: [] } };
  }

  const links = [];
  if (d.contractIdentity) {
    try {
      links.push(linkRecord({
        link_kind: "depends-on", from_identity: claim.identity, to_identity: d.contractIdentity,
        source_id, contributor_id, declared_grade: "checked",
      }));
    } catch (e) {
      return { proposal: null, receipt: { decision: "declined", error: "malformed link: " + e.message, findings: [], grade_table: [] } };
    }
  }

  const tables = { kindTable: makeKindTable(raw.kinds), sourceTable: makeSourceTable(raw.sources) };
  const contribution = { hash: claim.hash, entries: [claim], links };
  const view = storeViewOf(raw.state, tables);
  const receipt = decide(contribution, view, {});
  receipt.proposed_identity = claim.identity;
  return { proposal: { entries: [claim], links }, receipt };
}
