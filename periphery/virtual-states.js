// Role: the virtual layer's own three states (Phase KG-6b): drafted, gate-passed, submitted. A wholly
//   separate vocabulary from periphery/ladder.js's own three-state ladder (gate-passed, admitted,
//   semantically accepted): never appended to STATES there, never rendered through renderLadder. The
//   two vocabularies share the word "gate-passed" because both name the identical mechanical event (a
//   proposal grounds structurally against a graph); a virtual never renders "admitted" or "semantically
//   accepted", because those describe what the mirror does, never what a device's own outbox can claim
//   for itself.
// Contract: VIRTUAL_STATES (ordered array of {id, label, caption}); labelFor(id) -> label string.
// Invariant: no label here is "Admitted" or "Semantically accepted"; admission dissolves a virtual
//   entirely (it leaves the outbox, api/outbox.js's sweepAdmitted) rather than advancing it to a fourth
//   virtual state that would shadow the ladder's own act.
"use strict";

export const VIRTUAL_STATES = [
  { id: "drafted", label: "Drafted", caption: "Held on this device, not yet re-checked against a fresh snapshot." },
  { id: "gate-passed", label: "Gate-passed (queued)", caption: "Grounds structurally against the snapshot it was queued against. Queued for the next sync, not yet re-verified against a current one." },
  { id: "submitted", label: "Submitted (pending)", caption: "Re-checked against a fresh snapshot and re-exported. Pending admission, which is the target community's act, never this device's to declare." },
];

export function labelFor(id) {
  const s = VIRTUAL_STATES.find((v) => v.id === id);
  return s ? s.label : id;
}
