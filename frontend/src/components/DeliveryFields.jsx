import React, { useState } from "react";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { reservationLabel } from "../i18n/reservations";
import { deliveryLabel } from "../i18n/delivery";
import DeliveryMap from "./DeliveryMap";

export default function DeliveryFields({ value, onChange, zone, quote, quoteError }) {
  const { language, money } = useCustomerPreferences();
  const [locationError, setLocationError] = useState(false);
  const t = key => deliveryLabel(language, key);
  const update = (key, next) => onChange(current => ({ ...current, [key]: next }));
  const locate = () => {
    setLocationError(false);
    if (!navigator.geolocation) return setLocationError(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => update("point", { lat: coords.latitude, lng: coords.longitude }),
      () => setLocationError(true), { timeout: 10000 },
    );
  };
  return <>
    {[["name", 80], ["phone", 24], ["address", 180], ["house", 35], ["apartment", 35], ["entrance", 35], ["comment", 300]].map(([key, max], index) =>
      <label key={key} className="cafe-option pickup-contact-field">{index < 2 ? reservationLabel(language, key) : t(key)}
        <input type={key === "phone" ? "tel" : "text"} maxLength={max} required={index < 4} value={value[key]} onChange={event => update(key, event.target.value)} />
      </label>)}
    <p>{t("map")}</p>
    {zone && <DeliveryMap language={language} center={zone.center} point={value.point} onPoint={point => update("point", point)} />}
    <button type="button" className="cafe-button cafe-button-outline" onClick={locate}>{t("location")}</button>
    {locationError && <p role="alert">{t("locationError")}</p>}
    {zone?.demo && <p>DEMO</p>}
    {quoteError && <p role="alert">{t(quoteError === "outside_zone" ? "outside" : "error")}</p>}
    {quote && <div aria-live="polite"><p>{t("fee")} · {money(quote.deliveryFee)}</p><p>{t("minutes")} · {quote.deliveryMinutes}</p></div>}
  </>;
}
