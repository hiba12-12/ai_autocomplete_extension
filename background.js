const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini'; 
const MAX_TOKENS = 24; 

const CACHE_LIMIT = 300;
const cache = new Map();

function cacheGet(key) {
  return cache.get(key);
}
function cacheSet(key, value) {
  if (cache.size >= CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

async function getCompletion(text) {
  if (cache.has(text)) {
    return { completion: cache.get(text) };
  }

  const { apiKey, model } = await chrome.storage.sync.get(['apiKey', 'model']);
  if (!apiKey) {
    return { error: 'no_api_key' };
  }

  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are an inline autocomplete engine, like GitHub Copilot but for prose. ' +
              'The user will send you the text they have typed so far. Reply with ONLY the ' +
              'continuation that should be appended immediately after it — no quotes, no ' +
              'preamble, no repeating their text. Keep it short: a few words up to one short ' +
              'clause. Match their tone, language, and punctuation style. If nothing sensible ' +
              'comes to mind, reply with an empty string.'
          },
          { role: 'user', content: text }
        ]
      })
    });
  } catch (err) {
    return { error: 'network_error', detail: String(err) };
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { error: `api_error_${resp.status}`, detail };
  }

  const data = await resp.json();
  const completion =
    data.choices?.[0]?.message?.content
      ?.replace(/\n+/g, ' ')
      ?.trim() || '';

  cacheSet(text, completion);
  return { completion };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'GET_COMPLETION') {
    getCompletion(msg.text).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  return false;
});