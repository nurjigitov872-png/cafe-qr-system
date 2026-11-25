import { API } from "../config/connections.js";
import { authHeaders } from "./api.js";

export async function deliveryRequest(path, { method = "GET", body, token, admin, requestId, signal } = {}) {
  const headers = admin ? authHeaders() : token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(API + "/delivery" + path, {
    method, signal, redirect: "error", cache: "no-store",
    headers: { ...headers, ...(body && { "Content-Type": "application/json" }), ...(requestId && { "Idempotency-Key": requestId }) },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error("Delivery request failed");
    error.status = response.status;
    error.code = (await response.json().catch(() => ({}))).code;
    throw error;
  }
  return response.status === 204 ? undefined : response.json();
}
