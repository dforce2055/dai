// Helpers de test (no es un *.test.mjs, no lo corre el runner).
// Mockean el `fetch` global para testear las rutas de red sin red real.

export function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

// Reemplaza globalThis.fetch por un stub que registra las llamadas, corre fn, y
// SIEMPRE restaura el fetch original.
export async function withMockFetch(handler, fn) {
  const orig = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    return handler(url, opts, calls.length - 1);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = orig;
  }
}
