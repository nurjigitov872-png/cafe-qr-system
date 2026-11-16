// Pure policy shared by Vite and the browser. Never includes secret values in errors.
const fail = message => { throw new Error("Connection configuration: " + message); };
export function isLoopback(host) {
  return host === "localhost" || host === "[::1]" || /^127(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host);
}
function parse(value, name) {
  if (typeof value !== "string" || !value.trim()) fail(name + " is required");
  let url;
  try { url = new URL(value); } catch { fail(name + " must be an absolute HTTP(S) URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || value.includes("\\")) fail(name + " contains unsupported URL components");
  return url;
}
function origin(value, name) {
  const url = parse(value, name);
  if (url.pathname !== "/") fail(name + " must contain only an origin");
  return url;
}
export function resolveConnections(env, { development = false, pageOrigin } = {}) {
  const appEnv = env.VITE_APP_ENV;
  if (!["local", "staging", "production", "push-lab"].includes(appEnv)) fail("VITE_APP_ENV must be local, staging, production or push-lab");
  const api = parse(env.VITE_API_URL, "VITE_API_URL");
  if (!["/", "/api", "/api/"].includes(api.pathname)) fail("API path must be empty or /api");
  const socket = env.VITE_SOCKET_URL ? origin(env.VITE_SOCKET_URL, "VITE_SOCKET_URL") : new URL(api.origin);
  if (socket.origin !== api.origin) fail("API and Socket.IO must use the same origin");
  if (development && (appEnv !== "local" || !isLoopback(api.hostname))) fail("development requires local loopback connections");
  if (appEnv === "local") {
    if (!isLoopback(api.hostname)) fail("local connections require a loopback host");
    if (pageOrigin && !isLoopback(origin(pageOrigin, "page origin").hostname)) fail("local builds must run on loopback");
  } else {
    const backend = origin(env.VITE_BACKEND_ORIGIN, "VITE_BACKEND_ORIGIN");
    const frontend = origin(env.VITE_FRONTEND_ORIGIN, "VITE_FRONTEND_ORIGIN");
    if (backend.protocol !== "https:" || frontend.protocol !== "https:" || isLoopback(backend.hostname) || isLoopback(frontend.hostname)) fail("remote environments require HTTPS remote origins");
    if (backend.origin !== api.origin) fail("API does not match the approved backend origin");
    if (appEnv === "push-lab" && frontend.origin !== backend.origin) fail("push-lab requires a single origin");
    if (pageOrigin && pageOrigin !== frontend.origin) fail("page does not match the approved frontend origin");
  }
  return Object.freeze({ appEnv, apiBaseUrl: api.origin + "/api", socketOrigin: socket.origin });
}
