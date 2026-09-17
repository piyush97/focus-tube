const api = globalThis.browser ?? globalThis.chrome;

const CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer"
].join(",");
const TITLE_SELECTORS = ["#video-title", "a#video-title-link", "h3 a"].join(",");
const CHANNEL_SELECTORS = ["ytd-channel-name a", "#channel-name a", ".ytd-channel-name"].join(",");
const DEFAULTS = { enabled: true, threshold: 0.82, workerUrl: "", workerToken: "" };
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const queue = new Set();
let settings = DEFAULTS;
let timer;
let processing = false;
let stats = { kept: 0, hidden: 0 };

function getSurface() {
  if (location.pathname === "/results") return "search";
  if (location.pathname === "/watch") return "watch recommendations";
  return "home";
}

function allowedSurface() {
  return location.pathname === "/" || location.pathname === "/results" || location.pathname === "/watch";
}

function metadata(card) {
  const title = card.querySelector(TITLE_SELECTORS)?.textContent?.trim();
  const channel = card.querySelector(CHANNEL_SELECTORS)?.textContent?.trim() || "Unknown channel";
  return title ? { title, channel, surface: getSurface() } : null;
}

function isShort(card) {
  return Boolean(card.querySelector("ytd-reel-item-renderer, a[href^='/shorts/']"));
}

function hideShortsShelves(root = document) {
  const shelves = root.matches?.("ytd-rich-shelf-renderer")
    ? [root]
    : root.querySelectorAll?.("ytd-rich-shelf-renderer") ?? [];

  shelves.forEach((shelf) => {
    if (shelf.querySelector("a[href^='/shorts/'], ytd-reel-item-renderer")) {
      shelf.classList.add("focustube-shorts-hidden");
    }
  });
}

function cacheKey(video) {
  return `focustube:${video.title.toLowerCase()}::${video.channel.toLowerCase()}`;
}

function cached(video) {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(video)));
    return value && Date.now() - value.savedAt < CACHE_TTL ? value.probability : null;
  } catch {
    return null;
  }
}

function cache(video, probability) {
  try {
    localStorage.setItem(cacheKey(video), JSON.stringify({ probability, savedAt: Date.now() }));
  } catch {}
}

function reveal(card, probability) {
  const keep = probability >= settings.threshold;
  card.classList.remove("focustube-pending");
  card.classList.toggle("focustube-visible", keep);
  card.classList.toggle("focustube-hidden", !keep);
  card.dataset.focustubeDecision = keep ? "kept" : "hidden";
  stats[keep ? "kept" : "hidden"] += 1;
  publishStats();
}

function publishStats() {
  api.storage.local.set({ sessionStats: stats });
  const badge = document.querySelector("#focustube-status");
  if (badge) badge.textContent = `${stats.kept} lessons kept · ${stats.hidden} distractions hidden`;
}

function showStatus() {
  if (document.querySelector("#focustube-status") || !document.body) return;
  const badge = document.createElement("div");
  badge.id = "focustube-status";
  badge.setAttribute("role", "status");
  document.body.append(badge);
  publishStats();
}

function restoreAll() {
  document.querySelectorAll(`${CARD_SELECTORS}`).forEach((card) => {
    card.classList.remove("focustube-pending", "focustube-hidden", "focustube-visible");
    delete card.dataset.focustubeQueued;
    delete card.dataset.focustubeDecision;
  });
  document.querySelectorAll(".focustube-shorts-hidden").forEach((shelf) => {
    shelf.classList.remove("focustube-shorts-hidden");
  });
  document.querySelector("#focustube-status")?.remove();
  queue.clear();
}

function scan(root = document) {
  if (!settings.enabled || !allowedSurface()) return restoreAll();
  showStatus();
  hideShortsShelves(root);
  const cards = root.matches?.(CARD_SELECTORS) ? [root] : root.querySelectorAll?.(CARD_SELECTORS) ?? [];
  cards.forEach((card) => {
    if (card.dataset.focustubeQueued || card.dataset.focustubeDecision) return;
    if (isShort(card)) {
      card.classList.remove("focustube-pending", "focustube-visible");
      card.classList.add("focustube-hidden");
      card.dataset.focustubeDecision = "short";
      stats.hidden += 1;
      publishStats();
      return;
    }
    card.dataset.focustubeQueued = "true";
    card.classList.add("focustube-pending");
    queue.add(card);
  });
  clearTimeout(timer);
  timer = setTimeout(processQueue, 220);
}

async function processQueue() {
  if (processing || !queue.size || !settings.enabled) return;
  processing = true;
  const cards = [...queue].slice(0, 20);
  cards.forEach((card) => queue.delete(card));

  const entries = cards.map((card) => ({ card, video: metadata(card) })).filter((entry) => entry.video);
  cards.filter((card) => !metadata(card)).forEach((card) => {
    card.classList.remove("focustube-pending");
    delete card.dataset.focustubeQueued;
  });

  const uncached = [];
  entries.forEach((entry) => {
    const probability = cached(entry.video);
    if (probability === null) uncached.push(entry);
    else reveal(entry.card, probability);
  });

  if (uncached.length && settings.workerUrl && settings.workerToken) {
    try {
      const response = await fetch(`${settings.workerUrl.replace(/\/$/, "")}/classify`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.workerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ videos: uncached.map(({ video }) => video) })
      });
      if (!response.ok) throw new Error(`Worker returned ${response.status}`);
      const result = await response.json();
      uncached.forEach((entry, index) => {
        const probability = Number(result.results?.[index]?.probability ?? 0);
        cache(entry.video, probability);
        reveal(entry.card, probability);
      });
    } catch (error) {
      console.warn("FocusTube classification failed:", error);
      uncached.forEach(({ card }) => reveal(card, 0));
    }
  } else {
    uncached.forEach(({ card }) => reveal(card, 0));
  }

  processing = false;
  if (queue.size) processQueue();
}

async function start() {
  const [synced, local] = await Promise.all([
    api.storage.sync.get({ enabled: true, threshold: 0.82, workerUrl: "" }),
    api.storage.local.get({ workerToken: "" })
  ]);
  settings = { ...DEFAULTS, ...synced, ...local };
  stats = { kept: 0, hidden: 0 };
  api.storage.local.set({ sessionStats: stats });
  if (document.body) scan();
  else document.addEventListener("DOMContentLoaded", () => scan(), { once: true });

  new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("yt-navigate-finish", () => {
    restoreAll();
    scan();
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" && area !== "local") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    restoreAll();
    scan();
  });
}

start();
