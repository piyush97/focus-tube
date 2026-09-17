const api = globalThis.browser ?? globalThis.chrome;
const form = document.querySelector("#form");
const input = document.querySelector("#workerUrl");
const tokenInput = document.querySelector("#workerToken");
const status = document.querySelector("#status");

Promise.all([
  api.storage.sync.get({ workerUrl: "" }),
  api.storage.local.get({ workerToken: "" })
]).then(([{ workerUrl }, { workerToken }]) => {
  input.value = workerUrl;
  tokenInput.value = workerToken;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const workerUrl = input.value.trim().replace(/\/$/, "");
  const workerToken = tokenInput.value.trim();
  status.className = "";
  status.textContent = "Testing connection…";
  try {
    const response = await fetch(`${workerUrl}/health`, {
      headers: { "Authorization": `Bearer ${workerToken}` }
    });
    if (!response.ok) throw new Error(`Worker returned ${response.status}`);
    const body = await response.json();
    if (body.status !== "ok") throw new Error("Unexpected health response");
    await Promise.all([
      api.storage.sync.set({ workerUrl }),
      api.storage.local.set({ workerToken })
    ]);
    status.className = "ok";
    status.textContent = "Connected. Return to YouTube and refresh.";
  } catch (error) {
    status.className = "error";
    status.textContent = `Could not connect: ${error.message}`;
  }
});
