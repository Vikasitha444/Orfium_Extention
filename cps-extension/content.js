// ===== CPS Dashboard Tweaks =====
// Aluth tweak ekak add karanna: TWEAKS array ekata danna, applyTweaks() eke handle karanna.

const TWEAKS = [
  {
    name: "Hide review/claim buttons",
    urlIncludes: "/claims/manual",
    //hideButtonsWithText: ["Mark as reviewed", "Claim"],
  },
  {
    name: "Sub-3s warning",
    urlIncludes: "/claims/manual",
    // Udin patan: palaveni match wena tier eka pennanawa (max = seconds, inclusive)
    durationTiers: [
      { max: 3, text: "⚠️ DO NOT CLAIM SUB 3 ⚠️", bg: "#d93025", color: "#fff" },
      { max: 7, text: "⏱️ SHORT USE", bg: "#f9ab00", color: "#202124" },
    ],
  },
];

// ---------- helpers ----------
function parentOf(el) {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode && el.getRootNode();
  return root && root.host ? root.host : null; // shadow root eken eliyata
}

function* walk(root) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    yield node;
    if (node.shadowRoot) stack.push(node.shadowRoot);
    const kids = node.children ? Array.from(node.children) : [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]); // DOM order
  }
}

function isTab(el) {
  return !!el.closest(
    '[role="tab"], [role="tablist"], tp-yt-paper-tab, tp-yt-paper-tabs, ytcp-tabs'
  );
}

// ---------- tweak 1: hide buttons ----------
function hideButtonsByText(texts) {
  const wanted = texts.map((t) => t.trim().toLowerCase());
  for (const node of walk(document.body)) {
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag !== "ytcp-button" && tag !== "button") continue;
    if (isTab(node)) continue;
    const label = (node.innerText || node.textContent || "").trim().toLowerCase();
    if (!wanted.includes(label)) continue;
    const target = node.closest("ytcp-button") || node;
    target.style.setProperty("display", "none", "important");
  }
}

// ---------- tweak 2: duration tracker + warning ----------
function parseTime(str) {
  // "00:03", "0:03.5", "1:02:03", "3" -> seconds. Empty/invalid -> null
  if (!str || !str.trim()) return null;
  const parts = str.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function fieldKind(input) {
  // Input eka udata yaddi palaveni "Start time" ho "End time" label eka hamuwena thanin kind eka denawa
  const own = ((input.getAttribute("aria-label") || "") + " " + (input.placeholder || "")).toLowerCase();
  if (own.includes("start time")) return "start";
  if (own.includes("end time")) return "end";

  let el = input;
  for (let i = 0; i < 8 && el; i++) {
    el = parentOf(el);
    if (!el) break;
    const text = (el.innerText || el.textContent || "").toLowerCase();
    const hasStart = text.includes("start time");
    const hasEnd = text.includes("end time");
    if (hasStart && hasEnd) break; // godak udata giya
    if (hasStart) return "start";
    if (hasEnd) return "end";
  }
  return null;
}

let loggedMissing = false;
function findTimeInputs() {
  // Segments okkoma, DOM order eken
  const starts = [];
  const ends = [];
  let count = 0;
  for (const node of walk(document.body)) {
    if (!(node instanceof Element) || node.tagName !== "INPUT") continue;
    count++;
    const kind = fieldKind(node);
    if (kind === "start") starts.push(node);
    else if (kind === "end") ends.push(node);
  }
  if ((!starts.length || !ends.length) && !loggedMissing) {
    loggedMissing = true;
    console.log("[CPS] Start/End time inputs hoyaganna bari una. Inputs found:", count);
  }
  return { starts, ends };
}

function findAssetLabel() {
  for (const node of walk(document.body)) {
    if (
      node instanceof Element &&
      node.classList &&
      node.classList.contains("asset-select-label") &&
      (node.textContent || "").includes("Asset for claim")
    ) {
      return node;
    }
  }
  return null;
}

function getBanner() {
  let banner = document.getElementById("cps-duration-banner");
  if (!banner) {
    banner = document.createElement("span");
    banner.id = "cps-duration-banner";
    banner.style.cssText =
      "margin-left:12px;padding:3px 10px;border-radius:6px;font:700 13px Roboto,Arial,sans-serif;white-space:nowrap;";
  }
  const label = findAssetLabel();
  if (label) {
    // "Asset for claim" ekata dakunu paththe pennanna
    label.style.setProperty("display", "flex", "important");
    label.style.setProperty("align-items", "center", "important");
    if (banner.parentElement !== label) label.appendChild(banner);
  } else if (!banner.isConnected) {
    // Label eka na nam, page eka udata fixed widiyata
    banner.style.position = "fixed";
    banner.style.top = "80px";
    banner.style.right = "20px";
    banner.style.zIndex = "99999";
    document.body.appendChild(banner);
  }
  return banner;
}

function removeBanner() {
  const b = document.getElementById("cps-duration-banner");
  if (b) b.remove();
}

function updateDuration(tiers) {
  const { starts, ends } = findTimeInputs();
  const pairs = Math.min(starts.length, ends.length);

  let total = 0;
  let counted = 0;
  for (let i = 0; i < pairs; i++) {
    const s = parseTime(starts[i].value);
    const e = parseTime(ends[i].value);
    if (s === null || e === null || e < s) continue; // adu / waradi segment skip
    total += e - s;
    counted++;
  }
  if (!counted) return removeBanner();

  const banner = getBanner();
  const tier = tiers.find((t) => total <= t.max);
  const info = `${total.toFixed(1)}s`;

  if (tier) {
    banner.textContent = `${tier.text} (${info})`;
    banner.style.background = tier.bg;
    banner.style.color = tier.color;
  } else {
    banner.textContent = `Duration: ${info}`;
    banner.style.background = "#e6f4ea";
    banner.style.color = "#137333";
  }
}

// ---------- main loop ----------
function applyTweaks() {
  let durationActive = false;
  for (const tweak of TWEAKS) {
    if (tweak.urlIncludes && !location.href.includes(tweak.urlIncludes)) continue;
    if (tweak.hideButtonsWithText) hideButtonsByText(tweak.hideButtonsWithText);
    if (tweak.durationTiers) {
      durationActive = true;
      updateDuration(tweak.durationTiers);
    }
  }
  if (!durationActive) removeBanner();
}

let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(applyTweaks, 150);
}).observe(document.documentElement, { childList: true, subtree: true });
setInterval(applyTweaks, 250);
applyTweaks();
