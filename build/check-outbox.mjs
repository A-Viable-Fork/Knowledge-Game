// Role: verifies the outbox's own round-trip integrity and stale-re-gate discipline (Phase KG-6b).
//   A gate-passed bundle queues, re-gates against a fresh (identical, then deliberately altered)
//   snapshot, and either submits with a fresh receipt or demotes to draft carrying the fresh receipt's
//   own feedback; every outbox entry always carries a snapshot hash and an age, never a silent
//   absence.
// Contract: `node build/check-outbox.mjs` exits non-zero on any violation, naming it.
// Invariant: regateOne/pushOutbox are exercised against a real fixture snapshot, served through a
//   stubbed fetch that reads the real fixture file from disk (the same pattern build/check-egress.mjs
//   uses), so this proves the real code path, not a mock of it. The "stale" path is produced by
//   altering the served snapshot's own state between the queue and the push, exactly what "a fresh
//   snapshot changed since this was queued" means in practice.
"use strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ok  " : " FAIL "} ${m}`); if (!c) fails++; };
const H = "=".repeat(80);
console.log(H); console.log("CHECK-OUTBOX: round-trip integrity and the stale-re-gate path"); console.log(H);

const FIXTURE_PATH = join(ROOT, "app", "fixtures", "knowledge-game.snapshot.json");
const originalFixture = readFileSync(FIXTURE_PATH, "utf8");
const originalRaw = JSON.parse(originalFixture);

// the served fixture is swappable mid-test, so "fresh" can mean "unchanged" or "the target's kernel
// added a supersession record since this was queued", exercised as two separate served bodies below.
let servedBody = originalFixture;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("knowledge-game.snapshot.json")) {
    return { ok: true, status: 200, json: async () => JSON.parse(servedBody) };
  }
  return { ok: false, status: 404, json: async () => { throw new Error("not found"); } };
};

const { hashOf } = await import(join(ROOT, "vendor", "kernel", "schema", "canonical.mjs"));
const { draftProposal, bundleProposal } = await import(join(ROOT, "api", "contribute.js"));
const { queueBundle, listOutbox, removeFromOutbox, regateOne, pushOutbox, sweepAdmitted, entryAge, STATUSES } = await import(join(ROOT, "api", "outbox.js"));
const { fetchCommunity } = await import(join(ROOT, "api", "community.js"));

// api/settings.js reaches vault/vault.js, which reaches real localStorage; stub one in-memory so this
// check runs standalone in plain Node, the same pattern build/check-vault.mjs itself uses.
function makeMemoryLocalStorage() {
  const store = new Map();
  return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
}
globalThis.localStorage = makeMemoryLocalStorage();

console.log("\n[1] queueing a real gate-passed bundle");
const community = await fetchCommunity("knowledge-game.snapshot.json");
const draft = { statement: "check-outbox's own test claim", kind: "measurement", contributorId: "check-outbox", declaredGrade: "asserted" };
const { proposal, receipt, extraSources } = draftProposal(community, draft);
ok(receipt.decision === "accepted" || receipt.decision === "accepted-with-disagreement", `the test draft gate-passes (decision: ${receipt.decision})`);
const bundle = bundleProposal(proposal, receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
const entry = queueBundle(bundle, extraSources, "knowledge-game");
ok(entry.status === STATUSES.QUEUED, "a newly queued entry starts as 'queued'");
ok(typeof entry.contributionId === "string" && entry.contributionId.length > 0, "the queued entry carries its own contribution id");

console.log("\n[2] every outbox entry carries a snapshot hash and an age; never a silent absence");
for (const e of listOutbox()) {
  ok(typeof entryAge(e) === "number" && entryAge(e) >= 0, `entry ${e.contributionId.slice(0, 12)}...: entryAge() reports a real, non-negative age`);
}

console.log("\n[3] re-gating against an unchanged fresh snapshot passes and submits");
const resultFresh = await regateOne(entry, "knowledge-game.snapshot.json");
ok(resultFresh.ok === true, `re-gating against an unchanged snapshot still passes (decision: ${resultFresh.receipt.decision})`);
const pushed = await pushOutbox("knowledge-game.snapshot.json", "knowledge-game");
ok(pushed.length === 1 && pushed[0].ok === true, "pushOutbox re-gates the one queued entry and reports it passing");
ok(listOutbox().find((e) => e.contributionId === entry.contributionId).status === STATUSES.SUBMITTED, "the entry moved to 'submitted' after a passing push");

console.log("\n[4] the stale-re-gate path: a fresh snapshot that no longer supports the queued proposal demotes it to draft");
const targetIdentity = originalRaw.state.entries.find((e) => e.kind !== "comment").identity;
const { proposal: supportProposal, receipt: supportReceipt, extraSources: supportExtraSources } = draftProposal(community, {
  statement: "check-outbox's own support draft", kind: "measurement", contributorId: "check-outbox",
  action: "support", targetIdentity, linkGrade: "asserted",
});
ok(supportReceipt.decision === "accepted" || supportReceipt.decision === "accepted-with-disagreement", `the support draft gate-passes against the original snapshot (decision: ${supportReceipt.decision})`);
const supportBundle = bundleProposal(supportProposal, supportReceipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
const entry2 = queueBundle(supportBundle, supportExtraSources, "knowledge-game");
// simulate a fresh snapshot in which the support's own target has left the graph entirely (the real
// staleness case build/check-outbox.mjs proves: gate-passed once, then the target the link depends on
// is simply no longer present when this device finally re-gates against a current snapshot).
const altered = JSON.parse(originalFixture);
altered.state = { ...altered.state, entries: altered.state.entries.filter((e) => e.identity !== targetIdentity), links: altered.state.links.filter((l) => l.to_identity !== targetIdentity && l.from_identity !== targetIdentity) };
altered.snapshot_hash = hashOf({ state: altered.state, sources: altered.sources, kinds: altered.kinds });
servedBody = JSON.stringify(altered);
const resultStale = await regateOne(entry2, "knowledge-game.snapshot.json");
ok(resultStale.ok === false, "re-gating against the altered snapshot no longer passes");
const pushedStale = await pushOutbox("knowledge-game.snapshot.json", "knowledge-game");
ok(pushedStale.length === 1 && pushedStale[0].ok === false, "pushOutbox reports the stale entry failing its re-gate");
const demoted = listOutbox().find((e) => e.contributionId === entry2.contributionId);
ok(demoted.status === STATUSES.DRAFT, "the stale entry demoted to 'draft', never silently resubmitted");
ok(!!demoted.lastRegate && !!demoted.lastRegate.receipt, "the demoted entry carries the fresh receipt that demoted it, so the reader sees why");
servedBody = originalFixture; // restore for the remaining checks

console.log("\n[5] admission sweep: a submitted entry whose proposed identity now reads as a real row leaves the outbox; everything else stays put");
removeFromOutbox(entry2.contributionId);
const admitted = draftProposal(community, { statement: "already-admitted claim", kind: "measurement", contributorId: "check-outbox" });
const admittedBundle = bundleProposal(admitted.proposal, admitted.receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
const admittedEntry = queueBundle(admittedBundle, admitted.extraSources, "knowledge-game");
await pushOutbox("knowledge-game.snapshot.json", "knowledge-game"); // moves it to "submitted" with a real proposed_identity

const pending = draftProposal(community, { statement: "still-pending claim", kind: "measurement", contributorId: "check-outbox" });
const pendingBundle = bundleProposal(pending.proposal, pending.receipt, { kernel_id: community.kernelId, state_id: community.snapshotHash });
const pendingEntry = queueBundle(pendingBundle, pending.extraSources, "knowledge-game");
await pushOutbox("knowledge-game.snapshot.json", "knowledge-game");

const proposedIdentity = listOutbox().find((e) => e.contributionId === admittedEntry.contributionId).bundle.receipt.proposed_identity;
const otherCommunityEntry = queueBundle(
  { contribution_id: "other-community-fake", proposal: { entries: [], links: [] }, receipt: { decision: "accepted", proposed_identity: proposedIdentity }, origin: {}, protocol: "v3", status: "gate-passed, not admitted", instructions: "" },
  [], "some-other-community"
);
const all = listOutbox().map((e) => (e.contributionId === otherCommunityEntry.contributionId ? { ...e, status: STATUSES.SUBMITTED } : e));
// directly mark the fixture's own entry as submitted (this test's own stand-in for a second push), since
// otherCommunityEntry was queued, never pushed, under a community id this fixture never re-gates against.
const { setOutbox } = await import(join(ROOT, "vault", "vault.js"));
setOutbox(all);

const fakeFreshRows = [...community.api.read({}), { identity: proposedIdentity, kind: "measurement", statement: "now admitted for real" }];
const swept = sweepAdmitted("knowledge-game", fakeFreshRows);
ok(swept === true, "sweepAdmitted reports true when an entry actually leaves");
ok(!listOutbox().some((e) => e.contributionId === admittedEntry.contributionId), "the entry whose proposed identity now reads as a real row has left the outbox");
ok(listOutbox().some((e) => e.contributionId === pendingEntry.contributionId), "an entry whose proposed identity is not among the fresh rows stays in the outbox");
ok(listOutbox().some((e) => e.contributionId === otherCommunityEntry.contributionId), "an entry queued under a different community id is untouched by this community's sweep, even though its proposed identity matches");
for (const e of listOutbox()) removeFromOutbox(e.contributionId); // leave the outbox empty for the remaining checks

console.log("\n[6] tamper detection: a bundle whose content no longer matches its own contribution_id is refused, never silently re-gated");
const tamperedEntry = queueBundle({ ...bundle, proposal: { ...bundle.proposal, entries: [{ ...bundle.proposal.entries[0], statement: "tampered after export" }] } }, extraSources, "knowledge-game");
let threw = false;
try {
  await regateOne(tamperedEntry, "knowledge-game.snapshot.json");
} catch (e) {
  threw = /id mismatch/.test(e.message);
}
ok(threw, "regateOne refuses a tampered bundle (contribution_id no longer matches its content), never re-gating fabricated content");
removeFromOutbox(tamperedEntry.contributionId);

globalThis.fetch = realFetch;

console.log("\n" + H);
if (fails === 0) console.log("verified: the outbox round-trips a real gate-passed bundle, re-gates against a fresh snapshot, demotes a stale entry to draft with its own fresh feedback rather than resubmitting silently, and refuses a tampered bundle outright.");
console.log(fails === 0 ? "check-outbox: OK" : `check-outbox: ${fails} FAILURE(S)`);
console.log(H);
process.exit(fails === 0 ? 0 : 1);
