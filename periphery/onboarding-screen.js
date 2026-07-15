// Role: first-run onboarding (spec Section 6). Two screens: what do you want to learn (stored as
//   followed topics, feeding the learn-efficiently default), then one screen teaching the three-state
//   ladder and the grade-is-not-agreement point. Browsing is open throughout; no account exists to
//   gate anything, and every screen carries a skip.
// Contract: renderOnboardingScreen(container, ctx) -> void. ctx = { onFinish(topics, {activateDefault})
//   , onSkip() }. onFinish is called once, with the topics entered (possibly empty) and whether the
//   learn-efficiently ranker should activate as the default; onSkip is called if the reader skips
//   before entering anything.
// Invariant: nothing here reads or writes the vault directly; app.js persists whatever this reports
//   through api/settings.js, the same membrane every other screen uses. No step is mandatory: a skip
//   at any point reaches the feed with no topics recorded and no ranker activated.
"use strict";
import { renderLadder } from "./ladder.js";

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

export function renderOnboardingScreen(container, ctx) {
  container.innerHTML = "";
  let topicsText = "";
  let step = 1;

  function draw() {
    container.innerHTML = "";
    const skipBtn = el("button", { type: "button", class: "onboarding-skip" }, "Skip onboarding");
    skipBtn.addEventListener("click", () => ctx.onSkip());

    let body;
    if (step === 1) {
      body = el(
        "div",
        { class: "onboarding-step" },
        el("h2", {}, "What do you want to learn?"),
        el("p", {}, "Name a topic or two. This seeds the learn-efficiently ranker, an extension you can change or turn off any time from the Extensions screen."),
        el("label", {}, "Topics (comma-separated, optional)", el("input", { type: "text", oninput: (e) => (topicsText = e.target.value) })),
        el("button", { type: "button", class: "onboarding-continue", onclick: () => { step = 2; draw(); } }, "Continue")
      );
    } else {
      body = el(
        "div",
        { class: "onboarding-step" },
        el("h2", {}, "Before you start reading"),
        renderLadder("gate-passed"),
        el("p", {}, "A card's grade is a computed reading of its supporting structure, on device, from the public graph. It is never a claim of truth and never a stand-in for agreement: a well-supported claim can be well-supported and wrong, and a thin one can be right. Grade is what the structure currently shows, not a verdict."),
        el(
          "button",
          {
            type: "button", class: "onboarding-finish",
            onclick: () => {
              const topics = topicsText.split(",").map((t) => t.trim()).filter(Boolean);
              ctx.onFinish(topics, { activateDefault: topics.length > 0 });
            },
          },
          "Continue to the feed"
        )
      );
    }

    container.appendChild(
      el("section", { class: "onboarding-screen", "aria-label": "Onboarding" }, body, skipBtn)
    );
  }
  draw();
}
