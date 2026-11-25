import React, { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { CafeFrame, CUSTOMER_STATUSES, CUSTOMER_PAYMENTS } from "../components/CustomerUI";
import DeliveryTracking from "../components/DeliveryTracking";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { deliveryLabel } from "../i18n/delivery";
import { kitchenLabel } from "../i18n/kitchen";
import { deliveryRequest } from "../services/delivery";
import { bookingTime } from "../services/reservations";
import useDeliveryData from "./useDeliveryData";

export default function DeliveryOrder() {
  const { orderId } = useParams();
  const { language, t, money } = useCustomerPreferences();
  const d = key => deliveryLabel(language, key);
  const token = localStorage.getItem("order_token_" + orderId);
  const loader = useCallback(() => deliveryRequest("/orders/" + orderId, { token }), [orderId, token]);
  const { data: order, error } = useDeliveryData(loader);
  return <CafeFrame menuPath="/delivery"><section className="cafe-result-card cafe-tracking">
    <h1>{d("delivery")}</h1>
    {error && <p role="alert">{d("error")}</p>}
    {order && <>
      {order.deliveryDemo && <p>DEMO</p>}
      <p role="status">{d(order.deliveryState)} · {t(CUSTOMER_STATUSES[order.status] || order.status)}</p>
      {order.estimatedReadyAt && ["pending", "preparing"].includes(order.status) && <>
        <p>{kitchenLabel(language, "estimate")} · {bookingTime(order.estimatedReadyAt, language)} (UTC+6)</p>
        <p>{kitchenLabel(language, "note")}</p>
      </>}
      {!["delivered", "cancelled"].includes(order.deliveryState) && !order.tracking && <p>
        {d("minutes")} · {order.deliveryMinutes} · {d("km")} · {order.deliveryDistanceKm}
      </p>}
      {order.deliveryCode && <p><strong>{d("code")} · {order.deliveryCode}</strong></p>}
      <DeliveryTracking order={order} language={language} />
      <ul className="cafe-tracking-items">{order.items.map((item, index) => <li key={index}><span>{item.name} × {item.qty}</span><span>{money(item.qty * item.price)}</span></li>)}</ul>
      <p>{d("subtotal")} · {money(order.totalAmount - order.deliveryFee)}</p>
      <p>{d("fee")} · {money(order.deliveryFee)}</p>
      <p><strong>{t("Жалпы сумма")} · {money(order.totalAmount)}</strong></p>
      <p>{t(CUSTOMER_PAYMENTS[order.paymentStatus] || order.paymentStatus)}</p>
    </>}
    <Link className="cafe-button cafe-button-outline" to="/delivery">{t("Менюга кайтуу")}</Link>
  </section></CafeFrame>;
}
