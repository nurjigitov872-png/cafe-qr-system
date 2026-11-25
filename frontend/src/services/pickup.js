import { API } from "../config/connections.js";
import { authHeaders } from "./api.js";

async function pickupRequest(path, { method = "GET", body, headers = {}, signal } = {}) {
  const response = await fetch(API + "/checkout/pickup" + path, {
    method, headers: { ...headers, ...(body && { "Content-Type": "application/json" }) },
    body: body && JSON.stringify(body), redirect: "error", cache: "no-store", signal,
  });
  if (!response.ok) {
    const error = new Error("Pickup request failed");
    error.status = response.status;
    error.code = (await response.json().catch(() => ({}))).code;
    throw error;
  }
  return response.json();
}

export const createPickupOrder = (body, key) => pickupRequest("", { method: "POST", body, headers: { "Idempotency-Key": key } });
export const collectPickupOrder = (id, code) => pickupRequest("/" + id + "/collect", { method: "PATCH", body: { code }, headers: authHeaders() });
export const fetchPickupContact = id => pickupRequest("/" + id + "/contact", { headers: authHeaders() });
