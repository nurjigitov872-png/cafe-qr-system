import React, { useCallback, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import DeliveryTracking from "../components/DeliveryTracking";
import useAdminAuth from "./useAdminAuth";
import useDeliveryData from "./useDeliveryData";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { deliveryLabel } from "../i18n/delivery";
import { reservationLabel } from "../i18n/reservations";
import { deliveryRequest } from "../services/delivery";

const states = ["unassigned", "assigned", "accepted", "picked_up", "en_route", "delivered", "cancelled"];
const terminal = state => ["delivered", "cancelled"].includes(state);
const api = (path, options) => deliveryRequest("/admin" + path, { admin: true, ...options });

function CourierForm({ courier, language, onSave, busy }) {
  const t = key => deliveryLabel(language, key);
  return <form onSubmit={event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    onSave(courier?._id, values);
  }}>
    <label className="pos-field">{reservationLabel(language, "name")}<input name="name" required maxLength={80} defaultValue={courier?.name} /></label>
    <label className="pos-field">{t("username")}<input name="username" required maxLength={40} defaultValue={courier?.username} /></label>
    <label className="pos-field">{t("password")}<input name="password" type="password" autoComplete="new-password" required={!courier} minLength={12} maxLength={72} /></label>
    <button className="pos-button pos-button--primary" disabled={busy}>{t("save")}</button>
  </form>;
}

function TariffForm({ config, language, onSave, onPreview, busy }) {
  const t = key => deliveryLabel(language, key);
  const [provider, setProvider] = useState("internal");
  const numbers = ["radiusKm", "baseFee", "feePerKm", "speedKmh"];
  return <form onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onSave({
      center: { lat: Number(fields.get("latitude")), lng: Number(fields.get("longitude")) },
      ...Object.fromEntries(numbers.map(field => [field, Number(fields.get(field))])),
      demo: fields.has("demo"),
    });
  }}>
    {["latitude", "longitude", ...numbers].map(key => <label key={key} className="pos-field">{t(key)}
      <input type="number" name={key} required step="any" defaultValue={key === "latitude" ? config.center.lat : key === "longitude" ? config.center.lng : config[key]} /></label>)}
    <label className="pos-field"><input type="checkbox" name="demo" defaultChecked={config.demo} /> DEMO</label>
    <button className="pos-button pos-button--primary" disabled={busy}>{t("save")}</button>
    <label className="pos-field">{t("providers")}<select value={provider} onChange={event => setProvider(event.target.value)}>
      <option value="internal">{t("internal")}</option><option value="yandex">Yandex Delivery · DEMO</option><option value="glovo">Glovo On-Demand · DEMO</option>
    </select></label>
    <button type="button" className="pos-button pos-button--quiet" disabled={busy} onClick={() => onPreview(provider)}>{t("preview")}</button>
  </form>;
}

export default function AdminDelivery() {
  const { loading } = useAdminAuth();
  const { language, money } = useCustomerPreferences();
  const t = key => deliveryLabel(language, key);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState(null);
  const loader = useCallback(async () => {
    const [orders, couriers, settings] = await Promise.all([
      api("/orders" + (filter ? "?state=" + filter : "")), api("/couriers"), api("/settings"),
    ]);
    return { orders, couriers, settings };
  }, [filter]);
  const { data, load, error: loadError } = useDeliveryData(loader, !loading);
  const run = async action => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await action(); await load(); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const saveCourier = (id, body) => run(async () => {
    await api("/couriers" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body });
    setEditing(null);
  });
  const previewProvider = provider => run(async () => {
    const { center, radiusKm } = data.settings;
    const offset = Math.min(radiusKm / 4, 1) / 111;
    const result = await api("/provider-preview", { method: "POST", body: { provider, point: { lat: center.lat + (center.lat >= 89 ? -offset : offset), lng: center.lng } } });
    setPreview(result);
  });

  return <AdminLayout title={t("logistics")}>
    {(error || loadError) && <p className="pos-alert" role="alert">{t("error")}</p>}
    <section className="pos-panel">
      <h2>{t("delivery")}</h2>
      <label className="pos-field">{t("history")}<select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="">{t("all")}</option>{states.map(state => <option key={state} value={state}>{t(state)}</option>)}
      </select></label>
      {data?.orders.map(order => <article key={order._id} className="pos-panel">
        <strong>№{order._id.slice(-6)} · {t(order.deliveryState)} · {money(order.totalAmount)}</strong>
        {order.deliveryDemo && <p>DEMO</p>}
        <p>{order.items.map(item => item.name + " × " + item.qty).join(" · ")}</p>
        {["unassigned", "assigned", "accepted"].includes(order.deliveryState) && <label className="pos-field">{t("assign")}
          <select disabled={busy} value={order.courierId || ""} onChange={event => {
            const courierId = event.target.value;
            if (!courierId) return;
            run(() => api("/orders/" + order._id + "/assign", {
              method: "PATCH", body: { courierId, revision: order.deliveryRevision },
            }));
          }}>
            <option value="">{t("unassigned")}</option>
            {data.couriers.filter(courier => courier.active).map(courier =>
              <option key={courier._id} value={courier._id} disabled={courier.busy && courier._id !== order.courierId}>
                {courier.name} · {t(courier.busy ? "busy" : "free")}
              </option>)}
          </select></label>}
        {order.courierId && <p>{t("courier")} · {data.couriers.find(courier => courier._id === order.courierId)?.name}</p>}
        <DeliveryTracking order={order} language={language} center={data.settings.center} />
        {!terminal(order.deliveryState) && <button className="pos-button pos-button--quiet" disabled={busy} onClick={() => {
          if (window.confirm(reservationLabel(language, "cancel"))) run(() => deliveryRequest("/orders/" + order._id + "/cancel", { admin: true, method: "PATCH" }));
        }}>{reservationLabel(language, "cancel")}</button>}
      </article>)}
    </section>
    {data && <div className="pos-two-columns">
      <section className="pos-panel">
        <h2>{t("couriers")}</h2>
        {data.couriers.map(courier => <article key={courier._id} className="pos-product-row">
          <div><strong>{courier.name}</strong><p>{t(!courier.active ? "disabled" : courier.busy ? "busy" : "free")}</p></div>
          {courier.active && <div>
            <button className="pos-button pos-button--quiet" disabled={busy} onClick={() => setEditing(courier)}>{t("edit")}</button>
            <button className="pos-button pos-button--quiet" disabled={busy || courier.busy} onClick={() => {
              if (window.confirm(t("remove"))) run(() => api("/couriers/" + courier._id, { method: "DELETE" }));
            }}>{t("remove")}</button>
          </div>}
        </article>)}
        <CourierForm key={editing?._id || "new"} courier={editing} language={language} busy={busy} onSave={saveCourier} />
        {editing && <button className="pos-button pos-button--quiet" onClick={() => setEditing(null)}>{reservationLabel(language, "cancel")}</button>}
      </section>
      <section className="pos-panel">
        <h2>{t("tariffs")}</h2>
        <TariffForm key={JSON.stringify(data.settings)} config={data.settings} language={language} busy={busy}
          onSave={body => run(() => api("/settings", { method: "PUT", body }))} onPreview={previewProvider} />
        {preview && <p>{preview.demo && "DEMO · "}{t("fee")} {money(preview.deliveryFee)} · {t("minutes")} {preview.deliveryMinutes}</p>}
      </section>
    </div>}
  </AdminLayout>;
}
