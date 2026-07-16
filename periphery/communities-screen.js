// Role: the Communities page (Phase KG-7, the interface pass). The switcher, pins, and each
//   community's own sync state, moved off the slim bar onto its own page reached from the bottom nav.
//   Phase KG-12 Step 5 (the mirror): a community carrying contributionTarget shows it plainly (where
//   its own claims, and any promotion proposal about it, actually go); one carrying `mirror: true` is
//   a protocol repository joined as an ordinary browsable community, never privileged, and the page
//   renders the convention note once, above the list, rather than once per card.
// Contract: renderCommunitiesScreen(container, { communities, activeId, isPinned, pinAgeLabel,
//   lastSyncedLabel, onSelect, onTogglePin }). communities is the app's own registered list
//   ({id, label, contributionTarget?, mirror?}); onSelect(id) switches the active community and
//   returns to the feed; onTogglePin(community) pins or unpins.
// Invariant: renders only what it is given; no storage or network access of its own.
"use strict";

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function renderCommunitiesScreen(container, { communities, activeId, isPinned, pinAgeLabel, lastSyncedLabel, onSelect, onTogglePin }) {
  container.innerHTML = "";
  const hasMirror = communities.some((c) => c.mirror);
  container.appendChild(
    el(
      "section",
      { class: "communities-screen", "aria-label": "Communities" },
      el("h2", {}, "Communities"),
      hasMirror
        ? el(
            "p",
            { class: "mirror-convention-note" },
            "The mirror: the protocol's own repositories join this list as ordinary communities, snapshot by hash like any other. A promotion proposal about one (adopt something to shared) is an ordinary claim, argued in the open and decided by which communities choose to pin it, never a privileged act this app performs."
          )
        : null,
      el(
        "ul",
        { class: "communities-list" },
        ...communities.map((c) => {
          const pinned = isPinned(c.id);
          return el(
            "li",
            {},
            el(
              "div",
              {},
              el("button", { type: "button", "aria-current": String(c.id === activeId), onclick: () => onSelect(c.id) }, c.label),
              el("p", { class: "empty" }, `last synced: ${lastSyncedLabel(c.id)}`),
              c.contributionTarget ? el("p", { class: "community-contribution-target" }, `contributions: ${c.contributionTarget}`) : null
            ),
            el(
              "button",
              { type: "button", "aria-pressed": String(pinned), onclick: () => onTogglePin(c) },
              pinned ? `Unpin (${pinAgeLabel(c.id)})` : "Pin for offline"
            )
          );
        })
      )
    )
  );
}
