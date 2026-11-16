import { resolveConnections } from "./connectionPolicy.mjs";
// Evaluated before any API request or socket construction; invalid config fails closed.
export const connections = resolveConnections(import.meta.env, {
  development: import.meta.env.DEV === true,
  pageOrigin: typeof window !== "undefined" ? window.location?.origin : undefined,
});
export const API = connections.apiBaseUrl;
export const SOCKET = connections.socketOrigin;
