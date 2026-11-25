import React from "react";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { reservationLabel } from "../i18n/reservations";
import { pickupLabel } from "../i18n/pickup";
import { kitchenLabel } from "../i18n/kitchen";

export default function PickupFields({ value, onChange }) {
  const { language } = useCustomerPreferences();
  return <>
    <label className="cafe-option pickup-contact-field">{reservationLabel(language, "name")}<input type="text" required autoComplete="name" maxLength={80} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></label>
    <label className="cafe-option pickup-contact-field">{reservationLabel(language, "phone")}<input type="tel" required autoComplete="tel" maxLength={24} value={value.phone} onChange={event => onChange({ ...value, phone: event.target.value })} /></label>
    <p>{kitchenLabel(language, "asap")}</p>
    <p>{pickupLabel(language, "pay")}</p>
  </>;
}
