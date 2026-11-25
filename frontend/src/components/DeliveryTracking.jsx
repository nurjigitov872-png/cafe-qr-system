import React from "react";
import { deliveryGpsEnabled } from "../config/delivery";
import { deliveryLabel } from "../i18n/delivery";
import { bookingTime } from "../services/reservations";
import DeliveryMap from "./DeliveryMap";

export default function DeliveryTracking({ order, language, center }) {
  if (!deliveryGpsEnabled || order.deliveryState !== "en_route") return null;
  const t = key => deliveryLabel(language, key);
  return order.tracking ? <>
    <DeliveryMap language={language} center={center ?? order.destination ?? order.tracking} point={order.destination} courier={order.tracking} />
    <p>{t("stale")} · {bookingTime(order.tracking.updatedAt, language)} (UTC+6)</p>
    <p>{t("km")} · {order.tracking.distanceKm} · {t("minutes")} · {order.tracking.deliveryMinutes}</p>
  </> : <p>{t("waiting")}</p>;
}
