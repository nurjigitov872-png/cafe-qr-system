import React, { useCallback, useEffect, useState } from "react";
import { CafeFrame } from "../components/CustomerUI";
import { deliveryGpsEnabled } from "../config/delivery";
import { deliveryLabel } from "../i18n/delivery";
import { reservationLabel } from "../i18n/reservations";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { deliveryRequest } from "../services/delivery";
import useDeliveryData from "./useDeliveryData";

const next = { assigned: ["accepted", "accept"], accepted: ["picked_up", "pickup"], picked_up: ["en_route", "travel"], en_route: ["delivered", "complete"] };

export default function CourierPage() {
  const { language } = useCustomerPreferences();
  const t = key => deliveryLabel(language, key);
  const [token, setToken] = useState(() => sessionStorage.getItem("cafe_courier_token") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [gpsError, setGpsError] = useState(false);
  const [code, setCode] = useState("");
  const loader = useCallback(() => deliveryRequest("/courier/orders", { token }), [token]);
  const { data, error: loadError, load } = useDeliveryData(loader, Boolean(token));
  const active = data?.orders.find(order => next[order.deliveryState]);
  const shareId = deliveryGpsEnabled && data?.gpsEnabled && active?.deliveryState === "en_route" && sharing === active._id ? sharing : null;

  const logout = () => {
    setToken(""); setSharing(null); setCode("");
    sessionStorage.removeItem("cafe_courier_token");
  };

  useEffect(() => {
    if (!shareId) return;
    if (!navigator.geolocation) { setGpsError(true); return; }
    let lastSent = 0;
    const controller = new AbortController();
    const watch = navigator.geolocation.watchPosition(({ coords }) => {
      if (Date.now() - lastSent < 5000 || document.visibilityState === "hidden") return;
      lastSent = Date.now();
      deliveryRequest("/courier/orders/" + shareId + "/gps", {
        method: "PATCH", token, signal: controller.signal, body: { lat: coords.latitude, lng: coords.longitude },
      }).then(() => setGpsError(false)).catch(reason => {
        if (!controller.signal.aborted) setGpsError(![409, 429].includes(reason.status));
      });
    }, () => setGpsError(true), { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 });
    return () => { controller.abort(); navigator.geolocation.clearWatch(watch); };
  }, [shareId, token]);

  const login = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    const body = { username: fields.get("username"), password: fields.get("password") };
    try {
      const result = await deliveryRequest("/courier/login", { method: "POST", body });
      sessionStorage.setItem("cafe_courier_token", result.token);
      setToken(result.token);
    } catch (reason) { setError(reason.status === 429 ? "lock" : "error"); }
    finally { setBusy(false); }
  };

  const change = async () => {
    if (!active || busy) return;
    setBusy(true); setError("");
    const [state] = next[active.deliveryState];
    try {
      await deliveryRequest("/courier/orders/" + active._id + "/state", { method: "PATCH", token, body: { state, code } });
      if (state === "delivered") { setSharing(null); setCode(""); }
      await load();
    } catch (reason) { setError(reason.status === 429 ? "lock" : "error"); }
    finally { setBusy(false); }
  };

  return <CafeFrame menuPath="/delivery"><section className="cafe-result-card">
    <h1>{t("courier")}</h1>
    {(error || loadError) && <p className="cafe-alert" role="alert">{t(error || "error")}</p>}
    {!token ? <form onSubmit={login}>
      <label className="cafe-option pickup-contact-field">{t("username")}<input name="username" autoComplete="username" required /></label>
      <label className="cafe-option pickup-contact-field">{t("password")}<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="cafe-button cafe-button-primary" disabled={busy}>{t("signIn")}</button>
    </form> : <>
      <p>{data?.name}</p>
      <button className="cafe-button cafe-button-outline" onClick={logout}>{t("signOut")}</button>
      <h2>{t("active")}</h2>
      {active && <section>
        {active.deliveryDemo && <p>DEMO</p>}
        <p>№{active._id.slice(-6)} · {t(active.deliveryState)}</p>
        {active.contact && <address>
          <p>{active.contact.name} · <a href={"tel:" + active.contact.phone}>{active.contact.phone}</a></p>
          <p>{active.contact.address}, {active.contact.house}{active.contact.apartment && " · " + active.contact.apartment}{active.contact.entrance && " · " + active.contact.entrance}</p>
          {active.contact.comment && <p>{t("comment")} · {active.contact.comment}</p>}
        </address>}
        {active.deliveryState === "accepted" && active.status !== "ready" && <p>{reservationLabel(language, "pending")}</p>}
        {active.deliveryState === "en_route" && <>
          {deliveryGpsEnabled && data.gpsEnabled && <>
            <button type="button" className="cafe-button cafe-button-outline" onClick={() => { setSharing(shareId ? null : active._id); setGpsError(false); }}>{t(shareId ? "stop" : "share")}</button>
            <p>{t("background")}</p>
            {gpsError && <p role="alert">{t("locationError")}</p>}
          </>}
          <label className="cafe-option pickup-contact-field">{t("code")}<input value={code} maxLength={12} onChange={event => setCode(event.target.value)} /></label>
        </>}
        <button className="cafe-button cafe-button-primary" disabled={busy || (active.deliveryState === "accepted" && active.status !== "ready") ||
          (active.deliveryState === "en_route" && code.trim().length !== 12)} onClick={change}>{t(next[active.deliveryState][1])}</button>
      </section>}
      <h2>{t("history")}</h2>
      {data && <p>{t("delivered")} · {data.delivered} / {t("cancelled")} · {data.cancelled}</p>}
      {data?.orders.filter(order => !next[order.deliveryState]).map(order => <p key={order._id}>№{order._id.slice(-6)} · {t(order.deliveryState)}</p>)}
    </>}
  </section></CafeFrame>;
}
