// Role: verifies the three-state contribution ladder (claim 13: gate-passed, admitted, semantically
//   accepted render as three distinct states, and no rendering implies the next). Reads
//   periphery/ladder.js's own STATES array, the single source renderLadder draws every label and
//   caption from, so this check exercises exactly the text a reader ever actually sees rather than a
//   parallel description of it.
// Contract: `node build/check-ladder.mjs` exits non-zero on any violation, naming it.
// Invariant: this repository's checks run in plain Node with no DOM; renderLadder's own output is
//   exactly {label, caption} pairs drawn verbatim from STATES with no further generated text, so
//   testing STATES directly is equivalent to testing the rendered text content. A separate browser
//   smoke test (reported alongside this check) confirms the actual DOM rendering, not re-claimed as
//   proven here.
"use strict";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-LADDER: the three-state contribution ladder"); console.log(H);

const { STATES } = await import(join(ROOT, "periphery", "ladder.js"));

console.log("\n[1] exactly three states with distinct labels");
ok(STATES.length === 3, `the ladder carries exactly three states (got ${STATES.length})`);
const labels = STATES.map((s) => s.label);
ok(new Set(labels).size === labels.length, "every state's label is distinct");
ok(labels[0] === "Gate-passed" && labels[1] === "Admitted" && labels[2] === "Semantically accepted", `the three labels are Gate-passed, Admitted, Semantically accepted (got ${JSON.stringify(labels)})`);

console.log("\n[2] forbidden words absent from the first two states' renderings");
const FORBIDDEN = ["true", "validated", "verified", "accepted"];
for (let i = 0; i < 2; i++) {
  const text = `${STATES[i].label} ${STATES[i].caption}`.toLowerCase();
  for (const word of FORBIDDEN) {
    ok(!text.includes(word), `state '${STATES[i].label}': does not contain the forbidden word "${word}"`);
  }
}

console.log("\n[3] the third state's rendering is the one place \"accepted\" may appear (it IS semantic acceptance)");
const thirdText = `${STATES[2].label} ${STATES[2].caption}`.toLowerCase();
ok(thirdText.includes("accepted"), "the third state's own rendering names semantic acceptance");

console.log("\n[4] no rendering of a lower state contains a higher state's own label");
for (let i = 0; i < STATES.length; i++) {
  const text = `${STATES[i].label} ${STATES[i].caption}`.toLowerCase();
  for (let j = i + 1; j < STATES.length; j++) {
    ok(!text.includes(STATES[j].label.toLowerCase()), `state '${STATES[i].label}': does not contain the higher state label "${STATES[j].label}"`);
  }
}

console.log("\n" + H);
if (fails === 0) console.log("verified: the ladder carries exactly three distinct states, forbidden words absent from the first two, and no lower state's rendering contains a higher state's label.");
console.log(fails === 0 ? "check-ladder: OK" : `check-ladder: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
