// Matches backend notificationPolicy.eventFor("order.status", order).
export function orderStatusEvent(order) {
  if (!order?._id || !["pending", "preparing", "ready", "served", "cancelled"].includes(order.status)) return null;
  const date = order.updatedAt ? new Date(order.updatedAt) : null;
  if (date && !Number.isFinite(date.getTime())) return null;
  const orderId = String(order._id), version = date ? date.toISOString() : order.status;
  return { key: "order.status:" + orderId + ":" + order.status + ":" + version,
    kind: "order.status", orderId, status: order.status, tableNumber: order.tableNumber,
    createdAt: new Date().toISOString() };
}
export function emitOrderStatus(order) {
  const event = orderStatusEvent(order);
  if (event && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cafe:notification", { detail: event }));
  return order;
}
