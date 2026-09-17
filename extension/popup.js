const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { enabled: true, threshold: 0.82, workerUrl: "", workerToken: "" };
const enabled = document.querySelector("#enabled");
const threshold = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#thresholdValue");
const liveLabel = document.querySelector("#liveLabel");

function renderEnabled(value) {
  liveLabel.textContent = value ? "Live" : "Paused";
  liveLabel.classList.toggle("paused", !value);
}

async function init() {
  const [synced, local] = await Promise.all([
    api.storage.sync.get({ enabled: true, threshold: 0.82, workerUrl: "" }),
    api.storage.local.get({ workerToken: "", sessionStats: { kept: 0, hidden: 0 } })
  ]);
  const settings = { ...DEFAULTS, ...synced, workerToken: local.workerToken };
  const sessionStats = local.sessionStats;
  enabled.checked = settings.enabled;
  threshold.value = Math.round(settings.threshold * 100);
  thresholdValue.value = `${threshold.value}%`;
  renderEnabled(settings.enabled);
  document.querySelector("#kept").textContent = sessionStats.kept;
  document.querySelector("#hidden").textContent = sessionStats.hidden;
  const connection = document.querySelector("#connection");
  const configured = settings.workerUrl && settings.workerToken;
  connection.textContent = configured ? "Worker configured" : "Worker setup needed";
  connection.classList.toggle("missing", !configured);
}

enabled.addEventListener("change", () => {
  api.storage.sync.set({ enabled: enabled.checked });
  renderEnabled(enabled.checked);
});

threshold.addEventListener("input", () => {
  thresholdValue.value = `${threshold.value}%`;
});

threshold.addEventListener("change", () => api.storage.sync.set({ threshold: Number(threshold.value) / 100 }));
document.querySelector("#settings").addEventListener("click", () => api.runtime.openOptionsPage());
init();
