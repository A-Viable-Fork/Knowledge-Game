// Role: the case-claim walks (Phase KG-13 Step 2), the single source shared by periphery/app.js
//   (wiring the walk buttons into card ctx) and build/check-rooms.mjs (verifying every named target
//   is a real room), so the two can never silently drift apart.
// Contract: ROOM_WALKS is a Map(claim identity -> [{roomId, roomLabel}]). Each identity is the
//   competition community's own case-claim (kind "measurement", the exact statement hashed the same
//   way claimRecord always does); each entry names the room(s) that claim's own checking_records
//   cite by checker script. Every one of these four claims cites the room's checker script, never a
//   specific claim ref inside the room, so every walk targets the room's entry point, not a
//   fabricated anchor.
// Invariant: PURE data, no DOM, no network, no kernel import; importable from Node (check scripts)
//   and the browser alike.
"use strict";

export const ROOM_WALKS = new Map([
  ["86c34b97d7275aa870b0a3b02ef8bca1dfe8dd099c1664dfe2a4fb06bb39ec59", [{ roomId: "eggs", roomLabel: "the Eggs Room" }]], // "In the eggs corpus, nutritional epidemiology..."
  ["68a16b883ea3c23e1dd7339a09ea75b2346c07e1ab64acb14d327d5f96e710de", [ // "The repository carries working corpora for the three cases..."
    { roomId: "lhc", roomLabel: "the LHC Room" },
    { roomId: "eggs", roomLabel: "the Eggs Room" },
    { roomId: "covid", roomLabel: "the Covid Room" },
  ]],
  ["d47f51dfb5172e7402006fb2201804cf5fa2b2f306d84a5eaeed011bba345cc2", [{ roomId: "lhc", roomLabel: "the LHC Room" }]], // "In the LHC case, making the shared assumption..."
  ["aabc69a0d4de7b296f672fc4de40e232ebf74e401270eac5de62fd2c1d5dcce6", [{ roomId: "eggs", roomLabel: "the Eggs Room" }]], // "In the eggs case, swapping the presupposed frame..."
]);

export const ROOM_IDS = ["lhc", "eggs", "covid"];
