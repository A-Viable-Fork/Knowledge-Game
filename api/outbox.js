// Role: the outbox (Phase KG-6b). Gate-passed contribution bundles queue locally, each carrying its
//   own receipt and the snapshot hash it was gate-passed against, until a batched push re-gates every
//   queued entry against a fresh snapshot before it may leave as submitted. This app's own contribution
//   transport has never been a live network POST (bundleProposal's own "instructions" field always
//   named a manual bundle-plus-pull-request handoff); the outbox's push is therefore honestly scoped
//   as batched re-validation and re-export, never a new egress destination.
// Contract: queueBundle(bundle, extraSources) -> outbox entry, stored via api/settings.js. listOutbox()
//   -> entries, newest-queued first. removeFromOutbox(contributionId). regateOne(entry, communityPath)
//   -> { ok, receipt, snapshotHash }: re-fetches communityPath fresh, rebuilds the real records via
//   vendor/api/contribution.js's importContribution (which itself refuses a bundle whose content does
//   not match its own contribution_id), and reruns the real gate over the fresh state, exactly the
//   check a target kernel performs on submission. pushOutbox(communityPath) -> results[]: re-gates
//   every "queued" entry; a pass moves it to "submitted" with a fresh receipt and snapshot hash; a
//   fail demotes it to "draft" carrying the fresh receipt so periphery/gate-feedback.js's
//   describeReceipt can explain why, never resubmitted silently. sweepAdmitted(freshRows) -> boolean
//   (whether anything left): a "submitted" entry whose proposed identity now appears in a fresh read of
//   the community's rows has been admitted; the mirror carries it for real now, so it leaves the
//   outbox rather than shadowing what is already there.
// Invariant: regateOne trusts no field of the bundle's own stored receipt; the decision rendered is
//   always freshly computed, over freshly fetched, freshly hash-verified content. entries.extraSources
//   preserves exactly the citation source object the original draft used (api/contribute.js's own
//   draft* functions now return this), so a re-gate reconstructs the same source table a resubmission
//   would need without inventing a citation the draft never made.
// Governs: claim-7: regateOne's only network call is fetchCommunity's own already-declared destination;
//   the outbox opens no new destination for build/check-egress.mjs to miss.
"use strict";
import { fetchCommunity } from "./community.js";
import { makeSourceTable, makeKindTable } from "../vendor/kernel/schema/tables.mjs";
import { storeViewOf } from "../vendor/kernel/store/decay.mjs";
import { decide } from "../vendor/kernel/gate/gate.mjs";
import { rejectCommentSupport } from "../vendor/kernel/gate/comment-guard.mjs";
import { importContribution } from "../vendor/api/contribution.js";
import * as settings from "./settings.js";

export const STATUSES = Object.freeze({ QUEUED: "queued", SUBMITTED: "submitted", DRAFT: "draft" });

export function queueBundle(bundle, extraSources, communityId) {
  const existing = settings.getOutbox().filter((e) => e.contributionId !== bundle.contribution_id);
  const entry = {
    contributionId: bundle.contribution_id,
    communityId,
    bundle,
    extraSources: extraSources || [],
    queuedAt: Date.now(),
    status: STATUSES.QUEUED,
    lastRegate: null,
  };
  settings.setOutbox([...existing, entry]);
  return entry;
}

export function listOutbox() {
  return settings.getOutbox().slice().sort((a, b) => b.queuedAt - a.queuedAt);
}

export function removeFromOutbox(contributionId) {
  settings.setOutbox(settings.getOutbox().filter((e) => e.contributionId !== contributionId));
}

// re-gates one entry's bundle against a fresh fetch of communityPath. Never trusts the stored receipt.
export async function regateOne(entry, communityPath) {
  const fresh = await fetchCommunity(communityPath);
  const proposal = importContribution(entry.bundle); // throws on tamper; real, rebuilt record objects
  const sourcesForDecision = [...fresh.raw.sources, ...(entry.extraSources || [])];
  const tables = { kindTable: makeKindTable(fresh.raw.kinds), sourceTable: makeSourceTable(sourcesForDecision) };
  const contribution = { hash: proposal.entries[0].hash, entries: proposal.entries, links: proposal.links };
  const view = storeViewOf(fresh.raw.state, tables);
  try {
    rejectCommentSupport(contribution, view);
  } catch (e) {
    return { ok: false, receipt: { decision: "declined", error: e.message, findings: [], grade_table: [] }, snapshotHash: fresh.snapshotHash };
  }
  const receipt = decide(contribution, view, {});
  receipt.proposed_identity = proposal.entries[0].identity;
  const passed = receipt.decision === "accepted" || receipt.decision === "accepted-with-disagreement";
  return { ok: passed, receipt, snapshotHash: fresh.snapshotHash };
}

// the batched push: every "queued" entry FOR THIS COMMUNITY re-gates before it may become
// "submitted". A failing entry demotes to "draft", carrying the fresh receipt so the reader sees
// exactly why, never silently retried. communityId scopes the batch so pushing one community never
// re-gates another community's queued entries against the wrong snapshot.
export async function pushOutbox(communityPath, communityId) {
  const targets = listOutbox().filter((e) => e.status === STATUSES.QUEUED && (!communityId || e.communityId === communityId));
  const results = [];
  for (const entry of targets) {
    const { ok, receipt, snapshotHash } = await regateOne(entry, communityPath);
    const all = settings.getOutbox();
    const idx = all.findIndex((e) => e.contributionId === entry.contributionId);
    if (idx === -1) continue;
    const lastRegate = { at: Date.now(), snapshotHash, receipt };
    if (ok) {
      all[idx] = { ...all[idx], status: STATUSES.SUBMITTED, lastRegate, bundle: { ...all[idx].bundle, receipt } };
    } else {
      all[idx] = { ...all[idx], status: STATUSES.DRAFT, lastRegate };
    }
    settings.setOutbox(all);
    results.push({ contributionId: entry.contributionId, ok, receipt, snapshotHash });
  }
  return results;
}

// admission sweep: a "submitted" entry whose proposed identity now reads as a real row in ITS OWN
// community has been admitted for real; the mirror already carries it, so it leaves the outbox rather
// than shadowing it. Entries queued against a different community are left untouched, never swept by
// another community's fresh rows.
export function sweepAdmitted(communityId, freshRows) {
  const byIdentity = new Set(freshRows.map((r) => r.identity));
  const before = settings.getOutbox();
  const remaining = before.filter((e) => {
    if (e.communityId !== communityId) return true;
    const proposedIdentity = e.bundle && e.bundle.receipt && e.bundle.receipt.proposed_identity;
    const admitted = e.status === STATUSES.SUBMITTED && proposedIdentity && byIdentity.has(proposedIdentity);
    return !admitted;
  });
  if (remaining.length !== before.length) settings.setOutbox(remaining);
  return remaining.length !== before.length;
}

// the snapshot age an outbox entry's last regate (or its original queueing, before any regate) was
// taken against, in milliseconds; the periphery labels this "as of your snapshot, N days old".
export function entryAge(entry) {
  const at = (entry.lastRegate && entry.lastRegate.at) || entry.queuedAt;
  return Date.now() - at;
}
