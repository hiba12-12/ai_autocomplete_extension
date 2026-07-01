const enabledEl = document.getElementById('enabled');
const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const saveEl = document.getElementById('save');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(['enabled', 'apiKey', 'model'], (r) => {
  enabledEl.checked = r.enabled !== false;
  apiKeyEl.value = r.apiKey || '';
  modelEl.value = r.model || 'llama-3.1-8b-instant';
});

enabledEl.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledEl.checked });
});

saveEl.addEventListener('click', () => {
  chrome.storage.sync.set(
    {
      apiKey: apiKeyEl.value.trim(),
      model: modelEl.value
    },
    () => {
      statusEl.textContent = 'Saved.';
      setTimeout(() => (statusEl.textContent = ''), 1500);
    }
  );
});