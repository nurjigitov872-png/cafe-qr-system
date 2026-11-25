import { deliveryEnabled } from "../config/delivery";
import { deliveryLabel } from "../i18n/delivery";
import { smartKitchenEnabled } from "../config/kitchen";
import PreparationEstimate from "../components/PreparationEstimate";
import { kitchenLabel } from "../i18n/kitchen";
import { pickupEnabled } from "../config/pickup";
import { collectPickupOrder, fetchPickupContact } from "../services/pickup";
import { pickupLabel } from "../i18n/pickup";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import React, { useMemo, useRef, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { DataNotice, EmptyState, Icon, RefreshButton, StatusBadge } from "../components/AdminUI";
import { fetchOrders, updateOrderStatus } from "../services/api";
import { STATUS_LABELS, TYPE_LABELS, PAYMENT_LABELS, formatDate, money } from "../utils/adminData";
import useAdminData from "./useAdminData";
const EVENTS = ["order:new", "order:updated"];
export default function AdminOrders() {
  const { data, loading, error, load, updateItem } = useAdminData(fetchOrders, EVENTS);
  const { language } = useCustomerPreferences();
  const p = key => pickupLabel(language, key);
  const [contact, setContact] = useState(null);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const orders = useMemo(() => (data || []).filter(order => (!deliveryOnly || order.channel === "delivery") && (!filter || order.status === filter) && [order._id, order.tableNumber, ...(order.items || []).map(item => item.name)].join(" ").toLowerCase().includes(search.toLowerCase())), [data, filter, search, deliveryOnly]);
  const mutationLock = useRef(false);
  const viewContact = async id => {
    try { setContact({ id, ...await fetchPickupContact(id) }); }
    catch { setActionError("Байланыш маалыматы жеткиликсиз."); }
  };
  const changeStatus = async (id, status, pickup) => {
    if (mutationLock.current) return;
    const code = pickup && status === "served" ? window.prompt(p("code")) : null;
    if (pickup && status === "served" && !code) return;
    mutationLock.current = true;
    setContact(null);
    setBusy(id); setActionError("");
    try { const updated = code ? await collectPickupOrder(id, code) : await updateOrderStatus(id, status); updateItem(updated); await load(); }
    catch (error) { setActionError(error.status === 429 ? p("codeLocked") : "Заказдын статусун өзгөртүү мүмкүн болгон жок. Кайра аракет кылыңыз."); }
    finally { mutationLock.current = false; setBusy(""); }
  };
  return <AdminLayout title="Заказдар" subtitle="Заказдарды көзөмөлдөп, тейлөөнүн ар бир кадамын башкарыңыз." actions={<RefreshButton loading={loading} onClick={load} />}>
    <DataNotice loading={loading} error={actionError || error} onRetry={() => { setActionError(""); load(); }} />
    <div className="pos-toolbar"><div className="pos-filter-tabs" aria-label="Статус боюнча чыпка">{[["", "Баары"], ...Object.entries(STATUS_LABELS)].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>{deliveryEnabled && <button type="button" className="pos-button pos-button--quiet" aria-pressed={deliveryOnly} onClick={() => setDeliveryOnly(value => !value)}>{deliveryLabel(language, "delivery")}</button>}<label className="pos-search"><Icon name="search" size={17} /><input aria-label="Заказ издөө" placeholder="Заказ, стол же товар издөө…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {data && (orders.length ? <div className="pos-table-wrap"><table className="pos-orders-table"><caption className="pos-visually-hidden">Заказдар жана алардын статусу</caption><thead><tr><th scope="col">Заказ</th><th scope="col">Стол / түрү</th><th scope="col">Убактысы</th><th scope="col">Суммасы</th><th scope="col">Статус / башкаруу</th></tr></thead><tbody>{orders.map(order => <tr key={order._id}><td><span className="pos-order-id">№{String(order._id).slice(-6).toUpperCase()}</span><p className="pos-order-summary">{order.items?.length || 0} товар түрү</p><details className="pos-order-details"><summary>Заказдын курамы</summary><ul>{(order.items || []).map((item, i) => <li key={i}>{item.name} × {item.qty} · {money(item.price * item.qty)}{Object.keys(item.selectedOptions || {}).length > 0 && <span> · {Object.entries(item.selectedOptions).map(([key,value]) => key + ": " + value).join(", ")}</span>}</li>)}</ul>{order.comment && <p className="pos-order-comment"><strong>Эскертүү: </strong>{order.comment}</p>}</details></td><td data-label="Стол"><div>{pickupEnabled && order.channel === "pickup" ? <>
      <strong>{p("title")}</strong><p className="pos-order-payment">{order.scheduledFor ? formatDate(order.scheduledFor) : kitchenLabel(language, "asap")}</p>
      {["pending", "preparing", "ready"].includes(order.status) && <button className="pos-button pos-button--quiet" onClick={() => viewContact(order._id)}>{p("contact")}</button>}
      {contact?.id === order._id && ["pending", "preparing", "ready"].includes(order.status) && <p>{contact.name} · {contact.phone}</p>}
    </> : deliveryEnabled && order.channel === "delivery"
      ? <strong>{deliveryLabel(language, "delivery")} · {deliveryLabel(language, order.deliveryState)}</strong>
      : <><strong>Стол №{order.tableNumber}</strong><p className="pos-order-payment">{TYPE_LABELS[order.orderType] || "Түрү белгисиз"}</p></>}</div></td><td data-label="Убактысы"><time className="pos-order-time" dateTime={order.createdAt}>{formatDate(order.createdAt)}</time></td><td data-label="Суммасы"><div><strong className="pos-order-total">{money(order.totalAmount)}</strong><p className="pos-order-payment">{PAYMENT_LABELS[order.paymentMethod] || "Төлөм"}</p><p className="pos-order-payment">{PAYMENT_LABELS[order.paymentStatus] || "Төлөнө элек"}</p></div></td><td data-label="Статус"><div><StatusBadge status={order.status} /><select className="pos-order-status-select" aria-label={(pickupEnabled && order.channel === "pickup" ? p("title") : "Стол " + order.tableNumber) + ", заказ " + String(order._id).slice(-6) + ": статус"} value={order.status} disabled={!!busy} onChange={e => changeStatus(order._id, e.target.value, pickupEnabled && order.channel === "pickup")}>{Object.entries(STATUS_LABELS).map(([key,label]) => {
      const pickup = pickupEnabled && order.channel === "pickup";
      const allowed = { pending: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["served", "cancelled"] };
      if (pickup && key !== order.status && !allowed[order.status]?.includes(key)) return null;
      if (deliveryEnabled && order.channel === "delivery" && key !== order.status &&
          ({ pending: "preparing", preparing: "ready" })[order.status] !== key) return null;
      return <option value={key} key={key}>{pickup && key === "served" ? p("collect") : label}</option>;
    })}</select>{smartKitchenEnabled && <PreparationEstimate order={order} language={language} onSaved={updateItem} />}{busy === order._id && <span className="pos-saving" role="status">Сакталууда…</span>}</div></td></tr>)}</tbody></table><div className="pos-table-count">{orders.length} заказ көрсөтүлдү · Убакыт: Бишкек, UTC+6</div></div> : <section className="pos-panel"><EmptyState title="Заказ табылган жок" detail={filter || search ? "Издөөнү же статус чыпкасын өзгөртүп көрүңүз." : "Биринчи заказ түшкөндө ушул жерден көрөсүз."} /></section>)}
  </AdminLayout>;
}
