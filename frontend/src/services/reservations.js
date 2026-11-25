import { API } from "../config/connections.js";
import { authHeaders } from "./api.js";

export async function reservationRequest(path, { method = "GET", body, admin, token, signal } = {}) {
  const headers = admin ? authHeaders() : token ? { Authorization: "Bearer " + token } : {};
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(API + "/reservations" + path, {
    method, headers, signal, redirect: "error", cache: "no-store", body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error("Reservation request failed");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const bookingDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export const bookingTime = (date, language) => new Intl.DateTimeFormat(language, {
  timeZone: "Asia/Bishkek", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(date));
