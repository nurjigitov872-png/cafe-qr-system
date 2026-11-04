export const RESTAURANT_TIME_ZONE = "Asia/Bishkek";
export const STATUS_LABELS = { pending: "Күтүлүүдө", preparing: "Даярдалууда", ready: "Даяр", served: "Берилди", cancelled: "Жокко чыгарылды" };
export const TYPE_LABELS = { dinein: "Залда", takeaway: "Алып кетүү", delivery: "Жеткирүү" };
export const PAYMENT_LABELS = { cash: "Накталай", online: "Онлайн", card_online: "Онлайн карта", pending: "Төлөнө элек", paid: "Төлөндү", failed: "Төлөм өтпөдү" };
const numberFormat = new Intl.NumberFormat("ky-KG", { maximumFractionDigits: 2 });
export const formatNumber = value => numberFormat.format(Number.isFinite(Number(value)) ? Number(value) : 0);
export const money = value => formatNumber(value) + " сом";
export const dateKey = value => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RESTAURANT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = name => parts.find(p => p.type === name).value;
  return part("year") + "-" + part("month") + "-" + part("day");
};
export const formatCalendarDate = value => { const key = dateKey(value); return key ? key.split("-").reverse().join(".") : "Күн көрсөтүлгөн эмес"; };
export const formatDate = value => {
  const key = dateKey(value);
  if (!key) return "Убакыт көрсөтүлгөн эмес";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: RESTAURANT_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  return key.slice(8) + "." + key.slice(5, 7) + " · " + time;
};
const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function buildAnalytics(orders, now = new Date()) {
  const today = dateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - 6 + index);
    const key = date.toISOString().slice(0, 10);
    return { key, label: key.slice(8) + "." + key.slice(5, 7), orders: 0, revenue: 0 };
  });
  const byDay = new Map(days.map(day => [day.key, day]));
  const statuses = Object.fromEntries(Object.keys(STATUS_LABELS).map(key => [key, 0]));
  const products = new Map();
  let todayOrders = 0, todayRevenue = 0, weeklyOrders = 0, weeklyRevenue = 0;
  for (const order of orders) {
    if (Object.hasOwn(statuses, order.status)) statuses[order.status]++;
    const key = dateKey(order.createdAt);
    const day = byDay.get(key);
    if (key === today) todayOrders++;
    if (day) { day.orders++; weeklyOrders++; }
    if (order.status === "cancelled") continue;
    const total = amount(order.totalAmount);
    if (key === today) todayRevenue += total;
    if (day) { day.revenue += total; weeklyRevenue += total; }
    for (const item of order.items || []) {
      if (!item.name) continue;
      products.set(item.name, (products.get(item.name) || 0) + amount(item.qty));
    }
  }
  return { days, statuses, todayOrders, todayRevenue, weeklyOrders, weeklyRevenue,
    popular: [...products].filter(([, qty]) => qty > 0).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).slice(0, 5) };
}

// Presentation-only helpers; API enums and stored records are unchanged.
export const KITCHEN_NEXT = { pending: "preparing", preparing: "ready", ready: "served" };
export const KITCHEN_ACTIONS = { pending: "Күтүүгө кайтаруу", preparing: "Даярдоону баштоо", ready: "Даяр деп белгилөө", served: "Берилди деп белгилөө" };
export function kitchenQueue(orders, status) {
  const time = order => { const value = order.createdAt ? new Date(order.createdAt).getTime() : NaN; return Number.isFinite(value) ? value : Infinity; };
  return orders.filter(order => order.status === status).sort((a, b) => time(a) - time(b) || String(a._id).localeCompare(String(b._id)));
}
export function kitchenWait(createdAt, now = Date.now()) {
  const timestamp = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(timestamp) || !Number.isFinite(Number(now))) return null;
  const minutes = Math.max(0, Math.floor((Number(now) - timestamp) / 60000));
  return { minutes, level: minutes >= 30 ? "urgent" : minutes >= 15 ? "warning" : "normal" };
}
export function productCategories(products) {
  return [...new Set(products.map(product => typeof product.category === "string" ? product.category.trim() : "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "ky"));
}
