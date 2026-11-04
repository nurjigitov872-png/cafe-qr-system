import React, { useEffect, useRef, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { DataNotice, EmptyState, Icon, RefreshButton, StatusBadge } from "../components/AdminUI";
import { fetchOrders, updateOrderStatus } from "../services/api";
import { STATUS_LABELS, formatDate, money, KITCHEN_NEXT, KITCHEN_ACTIONS, kitchenQueue, kitchenWait } from "../utils/adminData";
import useAdminData from "./useAdminData";
const EVENTS = ["order:new", "order:updated"];

export default function AdminKitchen() {
  const { data, loading, error, load, updateItem } = useAdminData(fetchOrders, EVENTS);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(Date.now);
  const mutationLock = useRef(false);

  useEffect(() => {
    const refreshTime = () => setNow(Date.now());
    const timer = setInterval(refreshTime, 30000);
    document.addEventListener("visibilitychange", refreshTime);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refreshTime); };
  }, []);

  const update = async (id, status) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(id); setActionError("");
    try { const updated = await updateOrderStatus(id, status); updateItem(updated); await load(); }
    catch { setActionError("Статус жаңыртылган жок. Кайра аракет кылыңыз."); }
    finally { mutationLock.current = false; setBusy(""); }
  };

  return <AdminLayout title="Ашкана" subtitle="Эски заказдар алдыда. Даярдоонун ар бир кадамы көзөмөлдө." actions={<RefreshButton loading={loading} onClick={load} />}>
    <DataNotice loading={loading} error={actionError || error} onRetry={() => { setActionError(""); load(); }} />
    <p className="pos-kitchen-guide">Күтүү убактысы заказ түшкөндөн эсептелет: 15 мүн. — сары, 30 мүн. — кызгылт сары.</p>
    {data && <div className="pos-board">{Object.keys(KITCHEN_NEXT).map(status => {
      const orders = kitchenQueue(data, status);
      return <section className={"pos-board-column pos-board-column--" + status} key={status} aria-label={STATUS_LABELS[status]}>
        <div className="pos-board-heading"><h2><StatusBadge status={status} /></h2><span className="pos-count">{orders.length}</span></div>
        {orders.length ? orders.map(order => {
          const wait = kitchenWait(order.createdAt, now);
          const next = KITCHEN_NEXT[status];
          const secondary = Object.keys(KITCHEN_ACTIONS).filter(target => target !== status && target !== next);
          return <article className={"pos-panel pos-kitchen-card pos-kitchen-card--" + status} key={order._id}>
            <div className="pos-panel-heading"><div><h3>Стол №{order.tableNumber}</h3><p>№{String(order._id).slice(-6).toUpperCase()}</p></div><Icon name="clock" size={17} /></div>
            <time className="pos-order-time" dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
            {wait && <span className={"pos-wait-time pos-wait-time--" + wait.level}><Icon name="clock" size={14} />{wait.minutes} мүнөт күттү{wait.level === "urgent" && " · Көптөн күтүлүүдө"}</span>}
            <ul>{(order.items || []).map((item, index) => <li key={index}><span>{item.name}</span><strong>× {item.qty}</strong></li>)}</ul>
            {order.comment && <p className="pos-order-comment">{order.comment}</p>}
            <p className="pos-order-total">{money(order.totalAmount)}</p>
            <div className="pos-kitchen-actions">
              <button className="pos-button pos-button--primary" disabled={!!busy} onClick={() => update(order._id, next)}>{busy === order._id ? "Сакталууда…" : KITCHEN_ACTIONS[next]}</button>
              <details className="pos-secondary-actions"><summary>Кошумча аракеттер</summary><div>{secondary.map(target => <button key={target} className="pos-button pos-button--quiet" disabled={!!busy} onClick={() => update(order._id, target)}>{KITCHEN_ACTIONS[target]}</button>)}</div></details>
            </div>
          </article>;
        }) : <EmptyState icon="kitchen" title="Кезек бош" detail="Бул статустагы заказдар ушул жерде көрүнөт." />}
      </section>;
    })}</div>}
  </AdminLayout>;
}
