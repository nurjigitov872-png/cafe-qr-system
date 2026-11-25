import { smartKitchenEnabled } from "../config/kitchen";
import { kitchenLabel } from "../i18n/kitchen";
import { bookingTime } from "../services/reservations";
import { pickupLabel } from "../i18n/pickup";
import { pickupEnabled } from "../config/pickup";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { localizedField } from "../i18n/customer";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelOrder, getOrderById } from "../services/api";
import { CafeEmpty, CafeFrame, CafeIcon, CUSTOMER_STATUSES, CUSTOMER_PAYMENTS } from "../components/CustomerUI";
import "../utils/customerData";
export default function MyOrderPage({
  orderIdOverride,
  paymentReturn = false
}) {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  const {
    orderId: routeId
  } = useParams();
  const orderId = orderIdOverride ?? routeId;
  const [order, setOrder] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cancelLoading, setCancelLoading] = useState(false);
  const load = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setOrder(await getOrderById(orderId));
      setError("");
    } catch {
      setError("Заказды ачуу мүмкүн болгон жок. Бул заказ берилген браузерден ачып, кайра аракет кылыңыз.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const refresh = () => { if (orderId) getOrderById(orderId).then(setOrder).catch(() => {}); };
    const update = event => {
      if (event.detail?.orderId !== orderId) return;
      setOrder(current => current ? { ...current, status: event.detail.status } : current);
      if (pickupEnabled && event.detail.status === "ready") refresh();
    };
    window.addEventListener("cafe:order-status",update);window.addEventListener("cafe:order-refresh",refresh);
    const timer=setInterval(refresh,30000);
    return()=>{clearInterval(timer);window.removeEventListener("cafe:order-status",update);window.removeEventListener("cafe:order-refresh",refresh);};
  },[orderId]);
  const cancel = async () => {
    if (!window.confirm(t("Бул заказды жокко чыгаргыңыз келеби?"))) return;
    setCancelLoading(true);
    try {
      const result = await cancelOrder(orderId);
      setOrder(result);
      await load();
    } catch {
      setError("Заказды жокко чыгаруу мүмкүн болгон жок. Официанттан тактап алыңыз.");
    } finally {
      setCancelLoading(false);
    }
  };
  const table = order?.tableNumber || localStorage.getItem("lastOrderTable") || 1;
  const pickup = pickupEnabled && order?.channel === "pickup";
  const pickupPath = pickup ? "/pickup" : undefined;
  return <CafeFrame table={table} menuPath={pickupPath}><section className="cafe-result-card cafe-tracking"><span className="cafe-eyebrow">{t("СИЗДИН ЗАКАЗ")}</span><h1>{paymentReturn ? t("Заказ жана төлөм") : t("Менин заказым")}</h1>{loading && <p className="cafe-menu-loading" role="status"><span className="cafe-spinner" />{t("Маалымат жүктөлүүдө…")}</p>}{error && <div className="cafe-alert" role="alert">{t(error)}</div>}{!orderId && <CafeEmpty title={t("Заказ табылган жок")} detail={t("Менюдан товар тандап, заказ берсеңиз болот.")} />}{order && <><div className="cafe-tracking-header"><span>№{String(order._id).slice(-6).toUpperCase()} · {pickup ? pickupLabel(language, "title") : t("Стол") + " №" + order.tableNumber}</span><span className={"cafe-status cafe-status-" + order.status}>{t(CUSTOMER_STATUSES[order.status] || t("Статус белгисиз"))}</span></div>{pickup && <p>{order.scheduledFor
            ? <>{pickupLabel(language, "time")} · {new Intl.DateTimeFormat(language, { timeZone: "Asia/Bishkek", dateStyle: "medium" }).format(new Date(order.scheduledFor))} · {bookingTime(order.scheduledFor, language)} (UTC+6)</>
            : kitchenLabel(language, "asap")}</p>}
          {smartKitchenEnabled && order.estimatedReadyAt && ["pending", "preparing"].includes(order.status) && <div>
            <p><strong>{kitchenLabel(language, "estimate")} · {bookingTime(order.estimatedReadyAt, language)} (UTC+6)</strong></p>
            <p>{kitchenLabel(language, +new Date(order.estimatedReadyAt) <= Date.now() ? "delayed" : "note")}</p>
          </div>}
          {pickup && order.status === "ready" && order.pickupCode && <p><strong>{pickupLabel(language, "code")} · {order.pickupCode}</strong></p>}<p className="cafe-tracking-type">{{
            dinein: t("Залда"),
            takeaway: t("Алып кетүү"),
            delivery: t("Жеткирүү")
          }[order.orderType] || ""}</p><ul className="cafe-tracking-items">{(order.items || []).map((item, index) => <li key={index}><div><strong>{localizedField(item, "name", language)} × {item.qty}</strong>{Object.keys(item.selectedOptions || {}).length > 0 && <small>{Object.entries(item.selectedOptions).map(([key, value]) => key + ": " + value).join(" · ")}</small>}</div><span>{money(item.price * item.qty)}</span></li>)}</ul>{order.comment && <p className="cafe-tracking-comment"><strong>{t("Комментарий: ")}</strong>{order.comment}</p>}<div className="cafe-cart-total"><span>{t("Жалпы сумма")}</span><strong>{money(order.totalAmount)}</strong></div><div className="cafe-payment-state"><span>{t(CUSTOMER_PAYMENTS[order.paymentMethod] || t("Төлөм ыкмасы"))}</span><strong>{t(CUSTOMER_PAYMENTS[order.paymentStatus] || t("Төлөм статусу белгисиз"))}</strong></div>{paymentReturn && order.paymentStatus !== "paid" && <p className="cafe-payment-note">{t("Төлөмдүн ийгиликтүү аяктаганы азырынча ырасталган жок. Официанттан тактап алыңыз.")}</p>}</>}<div className="cafe-result-actions">{orderId && <button className="cafe-button cafe-button-outline" disabled={loading || cancelLoading} onClick={load}>{t("Статусту жаңыртуу")}</button>}{order?.status === "pending" && <button className="cafe-button cafe-button-danger" onClick={cancel} disabled={cancelLoading || loading}>{cancelLoading ? t("Жокко чыгарылууда…") : t("Заказды жокко чыгаруу")}</button>}<Link className="cafe-button cafe-button-primary" to={pickupPath || "/table/" + table}>{t("Менюга кайтуу")}<CafeIcon name="arrow" /></Link></div></section></CafeFrame>;
}
