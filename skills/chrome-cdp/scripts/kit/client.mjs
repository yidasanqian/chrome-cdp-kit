const DEFAULT_TIMEOUT = 15_000;

/**
 * Minimal browser-level CDP client. One WebSocket, request/response only.
 *
 * Resolves to a callable `send(method, params, sessionId)` with a `.close()`
 * method. Pass a flattened session id to talk to a tab; omit it for
 * browser-level commands.
 */
export function connect(wsUrl, { timeout = DEFAULT_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    let settled = false;
    const pending = new Map();

    const failAll = (error) => {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(error);
      }
      pending.clear();
    };

    function send(method, params = {}, sessionId) {
      const id = ++seq;
      return new Promise((resolveRequest, rejectRequest) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectRequest(new Error(`CDP timeout: ${method}`));
        }, timeout);
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
        const message = { id, method, params };
        if (sessionId) message.sessionId = sessionId;
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          rejectRequest(error);
        }
      });
    }

    send.close = () => {
      try {
        ws.close();
      } catch {
        // Already closed.
      }
    };

    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      send.close();
      reject(new Error(`CDP connect timeout: ${wsUrl}`));
    }, timeout);

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message.id || !pending.has(message.id)) return;
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(`${message.error.message} (${message.error.code})`));
      else entry.resolve(message.result);
    };

    ws.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      reject(new Error(event?.message ? `CDP connect failed: ${event.message}` : 'CDP connect failed'));
    };

    ws.onclose = () => {
      failAll(new Error('CDP connection closed'));
      if (!settled) {
        settled = true;
        clearTimeout(guard);
        reject(new Error('CDP connection closed before it opened'));
      }
    };

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(send);
    };
  });
}