import api, { getAccessToken } from './api';

const listeners = new Set();
const openListeners = new Set();
const statusListeners = new Set();
let ws = null, retry = 0, timer = null, stopped = true, gen = 0, status = 'offline';

function setStatus(s) { status = s; statusListeners.forEach((f) => f(s)); }

function schedule(g) {
  if (stopped || g !== gen) return;
  clearTimeout(timer);
  const delay = Math.min(1000 * 2 ** retry++, 15000); // 1s, 2s, 4s ... max 15s
  timer = setTimeout(() => connect(g), delay);
}

async function connect(g) {
  if (stopped || g !== gen) return;
  try { await api.get('/auth/me/'); }        // refreshes the access token via the interceptor if expired
  catch { setStatus('offline'); schedule(g); return; }
  if (stopped || g !== gen) return;
  const token = getAccessToken();
  if (!token) { schedule(g); return; }
  ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/?token=${encodeURIComponent(token)}`);
  ws.onopen = () => { retry = 0; setStatus('live'); openListeners.forEach((f) => f()); };
  ws.onmessage = (e) => {
    try { const msg = JSON.parse(e.data); listeners.forEach((f) => f(msg)); } catch { /* ignore */ }
  };
  ws.onclose = () => { if (g === gen) { ws = null; setStatus('offline'); schedule(g); } };
  ws.onerror = () => ws && ws.close();
}

export function startSocket() { stopped = false; gen += 1; retry = 0; connect(gen); }
export function stopSocket() { stopped = true; gen += 1; clearTimeout(timer); if (ws) ws.close(); ws = null; setStatus('offline'); }
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const onOpen = (fn) => { openListeners.add(fn); return () => openListeners.delete(fn); };
export const onStatus = (fn) => { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); };