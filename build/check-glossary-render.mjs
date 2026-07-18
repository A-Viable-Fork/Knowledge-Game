// Role: verifies the glossary render (KG-GLOSSARY). The vendored kernel/schema/glossary.mjs
//   (DESCRIBE-1) is the one source of every grade, kind, and link description a composer sees on the
//   contribute screen; periphery/contribute-screen.js's glossaryHelpFor is the exact DOM-free
//   resolution the render path uses, mirroring periphery/ladder.js's STATES, so this check exercises
//   precisely what would render, not a parallel description of it.
// Contract: `node build/check-glossary-render.mjs` exits non-zero on any violation, naming it.
// Invariant: read-only. Confirms the substrate carries the glossary, every control the draft form
//   offers resolves a description from it (no hand-authored drift), the declared-vs-earned tooltip
//   sits on the grade selector naming both sides, and the comment/reply form grows none of this.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-GLOSSARY-RENDER: the vendored glossary as compose-a-claim help"); console.log(H);

// =====================================================================================
console.log("\n[1] the substrate carries the glossary");
const { GRADES, KINDS, LINKS, CONCEPTS, glossary } = await import(join(ROOT, "vendor", "kernel", "schema", "glossary.mjs"));
const { POSITIONS } = await import(join(ROOT, "vendor", "kernel", "schema", "confidence.mjs"));
ok(!!GRADES && !!KINDS && !!LINKS && !!CONCEPTS && typeof glossary === "function", "vendor/kernel/schema/glossary.mjs exports GRADES, KINDS, LINKS, CONCEPTS, glossary()");
const positionKeys = Object.keys(POSITIONS);
const missingGrades = positionKeys.filter((k) => !GRADES[k]);
ok(missingGrades.length === 0, `GRADES covers every key in the vendored POSITIONS (missing: ${JSON.stringify(missingGrades)})`);

// =====================================================================================
console.log("\n[2] every control the draft form offers renders a description from the glossary");
const raw = JSON.parse(readFileSync(join(ROOT, "communities", "epistack-competition", "snapshot", "epistack-competition.snapshot.json"), "utf8"));
const { createLocalProvider } = await import(join(ROOT, "vendor", "api", "providers", "local-provider.mjs"));
const { createClientApi } = await import(join(ROOT, "vendor", "api", "client-api.mjs"));
const community = { api: createClientApi(createLocalProvider(raw)), kernelId: "epistack-competition", snapshotHash: "x", raw };
const { glossaryHelpFor } = await import(join(ROOT, "periphery", "contribute-screen.js"));

const kindOptions = (raw.kinds || []).map((k) => k.kind);
ok(kindOptions.length > 0, `the representative community declares at least one kind (${kindOptions.length}: ${kindOptions.join(", ")})`);
const supportHelp = glossaryHelpFor(community, "support", kindOptions);
for (const k of supportHelp.kinds) {
  ok(!!k.description, `kind "${k.kind}": the Kind selector resolves a description`);
  ok(!!k.ceiling, `kind "${k.kind}": the Kind selector resolves a ceiling`);
}
const GRADE_OPTIONS = ["asserted", "supported", "corroborated"];
ok(supportHelp.grades.length === GRADE_OPTIONS.length && supportHelp.grades.every((g, i) => g.grade === GRADE_OPTIONS[i]), "the support action offers exactly the three grade options, in order");
for (const g of supportHelp.grades) {
  ok(!!g.description, `grade "${g.grade}": the grade selector resolves a description`);
  ok(!!g.whenToUse, `grade "${g.grade}": the grade selector resolves a whenToUse`);
}

// =====================================================================================
console.log("\n[3] no hand-authored drift: every resolved description traces back to the vendored glossary");
for (const k of supportHelp.kinds) {
  ok(k.description === (KINDS[k.kind] || {}).description, `kind "${k.kind}": resolved description is glossary.KINDS["${k.kind}"].description, not a literal`);
}
for (const g of supportHelp.grades) {
  ok(g.description === (GRADES[g.grade] || {}).description, `grade "${g.grade}": resolved description is glossary.GRADES["${g.grade}"].description, not a literal`);
  ok(g.whenToUse === (GRADES[g.grade] || {}).whenToUse, `grade "${g.grade}": resolved whenToUse is glossary.GRADES["${g.grade}"].whenToUse, not a literal`);
}
ok(supportHelp.declaredVsEarned === (CONCEPTS["declared-vs-earned"] || {}).description, "the grade selector's centerpiece text is glossary.CONCEPTS[\"declared-vs-earned\"].description, not a literal");

// =====================================================================================
console.log("\n[4] the declared-vs-earned tooltip is on the grade selector, naming both sides");
const dve = supportHelp.declaredVsEarned;
ok(!!dve && dve.length > 0, "the support action's grade selector carries a non-empty declared-vs-earned tooltip");
ok(/declar/i.test(dve || ""), "the tooltip names the composer's declaration");
ok(/earn/i.test(dve || ""), "the tooltip names the gate's earned grade");
const promoteHelp = glossaryHelpFor(community, "promote", kindOptions.filter((k) => k !== "comment"));
ok(!!promoteHelp.declaredVsEarned, "the promote action's declared grade selector also carries the centerpiece tooltip");

// =====================================================================================
console.log("\n[5] the comment/reply form grows no grade, kind, or action tooltip");
for (const action of ["comment", "reply"]) {
  const help = glossaryHelpFor(community, action, kindOptions);
  ok(help.kinds.length === 0, `${action}: no Kind selector tooltip (ungraded, no kind selector)`);
  ok(help.grades.length === 0, `${action}: no grade selector tooltip`);
  ok(help.declaredVsEarned === null, `${action}: no declared-vs-earned tooltip`);
}
// contest/fork also offer no kind selector in this screen (the kind is fixed to the target's own)
for (const action of ["contest", "fork"]) {
  const help = glossaryHelpFor(community, action, kindOptions);
  ok(help.kinds.length === 0 && help.grades.length === 0 && help.declaredVsEarned === null, `${action}: no kind, grade, or declared-vs-earned tooltip (this screen fixes the target's own kind)`);
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the vendored glossary is complete against POSITIONS, every draft-form control resolves its description from it with no hand-authored drift, the declared-vs-earned tooltip sits on the grade selector naming both sides, and the comment/reply form grows none of it.");
console.log(fails === 0 ? "check-glossary-render: OK" : `check-glossary-render: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
