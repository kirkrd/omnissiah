async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-omnissiah': 'praise' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  state: () => call('GET', '/api/state'),
  create: (body) => call('POST', '/api/sessions', body),
  update: (id, patch) => call('PATCH', `/api/sessions/${id}`, patch),
  remove: (id) => call('DELETE', `/api/sessions/${id}`),
  petition: (id, text) => call('POST', `/api/sessions/${id}/petition`, { text }),
  abort: (id) => call('POST', `/api/sessions/${id}/abort`),
};

/** Subscribe to forge events; reconnects automatically. Returns unsubscribe. */
export function subscribe(onMessage, onStatus) {
  let es;
  let closed = false;
  let retry;
  const open = () => {
    es = new EventSource('/api/events');
    es.onopen = () => onStatus(true);
    es.onmessage = (e) => onMessage(JSON.parse(e.data));
    es.onerror = () => {
      onStatus(false);
      es.close();
      if (!closed) retry = setTimeout(open, 1500);
    };
  };
  open();
  return () => {
    closed = true;
    clearTimeout(retry);
    es?.close();
  };
}
