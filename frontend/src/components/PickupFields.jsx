import React, { useEffect, useState } from "react";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { reservationLabel } from "../i18n/reservations";
import { pickupLabel } from "../i18n/pickup";
import { bookingDay } from "../services/reservations";
import { fetchPickupTimes } from "../services/pickup";

export default function PickupFields({ value, onChange }) {
  const { language } = useCustomerPreferences();
  const t = key => reservationLabel(language, key);
  const p = key => pickupLabel(language, key);
  const [times, setTimes] = useState(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const change = (key, next) => onChange({ ...value, [key]: next, ...(key === "day" && { time: "" }) });
  useEffect(() => {
    setTimes(null);
    setError(false);
    if (!value.day) return;
    const controller = new AbortController();
    fetchPickupTimes(value.day, controller.signal)
      .then(data => { if (!controller.signal.aborted) setTimes(data.times); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [value.day, revision]);

  return <>
    <label className="cafe-option">{t("name")}<input type="text" autoComplete="name" maxLength={80} value={value.name} onChange={event => change("name", event.target.value)} /></label>
    <label className="cafe-option">{t("phone")}<input type="tel" autoComplete="tel" maxLength={24} value={value.phone} onChange={event => change("phone", event.target.value)} /></label>
    <label className="cafe-option">{p("day")}<input type="date" min={bookingDay()} value={value.day} onChange={event => change("day", event.target.value)} /></label>
    <label className="cafe-option">{p("time")} (UTC+6)<select value={value.time} disabled={!times?.length} onChange={event => change("time", event.target.value)}>
      <option value="">{times?.length === 0 ? t("noTimes") : !times && value.day && !error ? t("loading") : t("choose")}</option>
      {times?.map(time => <option key={time}>{time}</option>)}
    </select></label>
    {error && <><p role="alert" className="cafe-alert">{t("error")}</p><button type="button" className="cafe-button cafe-button-outline" onClick={() => setRevision(current => current + 1)}>{p("retry")}</button></>}
    <p>{p("pay")}</p>
  </>;
}
