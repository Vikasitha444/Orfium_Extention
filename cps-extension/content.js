// ===== CPS Dashboard Tweaks =====
// Aluth tweak ekak add karanna: TWEAKS array ekata danna, ilaga eka applyTweaks() eke handle karanna.

const TWEAKS = [
  {
    name: "Hide review/claim buttons",
    urlIncludes: "/claims/manual",
    hideButtonsWithText: ["Mark as reviewed", "Claim"],
  },
  {
    name: "Sub-3s warning",
    urlIncludes: "/claims/manual",
    durationWarning: { maxSeconds: 3, message: "DO NOT CLAIM SUB 3" },
  },
];

// ---------- helpers ----------
function* walk(root) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    yield node;
    if (node.shadowRoot) stack.push(node.shadowRoot);
    for (const child of node.children || []) stack.push(child);
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

function findTimeInputs() {
  // Page eke "Start time" / "End time" inputs (DOM order eke palaveni segment eka gannawa)
  const starts = [];
  const ends = [];
  for (const node of walk(document.body)) {
    if (!(node instanceof Element) || node.tagName !== "INPUT") continue;
    const box = node.closest(
      "ytcp-media-timestamp-input, ytcp-form-input-container, ytcp-form-textarea"
    );
    const text = ((box && box.innerText) || node.getAttribute("aria-label") || "")
      .toLowerCase();
    if (text.includes("start time")) starts.push({ input: node, box });
    else if (text.includes("end time")) ends.push({ input: node, box });
  }
  return { start: starts[0], end: ends[0] };
}

function getBanner(anchorEl) {
  let banner = document.getElementById("cps-duration-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "cps-duration-banner";
    banner.style.cssText =
      "margin:10px 0;padding:8px 12px;border-radius:8px;font:600 14px Roboto,Arial,sans-serif;max-width:340px;";
  }
  if (!banner.isConnected && anchorEl) {
    anchorEl.insertAdjacentElement("afterend", banner);
  }
  return banner;
}

function removeBanner() {
  const b = document.getElementById("cps-duration-banner");
  if (b) b.remove();
}

function updateDuration(cfg) {
  const { start, end } = findTimeInputs();
  if (!start || !end) return removeBanner();

  const s = parseTime(start.input.value);
  const e = parseTime(end.input.value);
  if (s === null || e === null || e < s) return removeBanner();

  const duration = e - s;
  const row = (start.box && start.box.parentElement) || start.input;
  const banner = getBanner(row);

  if (duration <= cfg.maxSeconds) {
    banner.textContent = `⚠️ ${cfg.message} ⚠️  (${duration.toFixed(1)}s)`;
    banner.style.background = "#d93025";
    banner.style.color = "#fff";
  } else {
    banner.textContent = `Duration: ${duration.toFixed(1)}s`;
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
    if (tweak.durationWarning) {
      durationActive = true;
      updateDuration(tweak.durationWarning);
    }
  }
  if (!durationActive) removeBanner();
}

// Real time: DOM wenas wena welawata + "Set start/end time" click karama input events fire wenne naththan
// nisa, 250ms gane poll karanawa.
let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(applyTweaks, 150);
}).observe(document.documentElement, { childList: true, subtree: true });
setInterval(applyTweaks, 250);
applyTweaks();
