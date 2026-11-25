import React, { useEffect, useState } from "react";
import { CafeFrame } from "../components/CustomerUI";
import ReservationFloorPlan from "../components/ReservationFloorPlan";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { reservationLabel } from "../i18n/reservations";
import { bookingDay, bookingTime, reservationRequest } from "../services/reservations";

export default function ReservationPage() {
  const { language } = useCustomerPreferences();
  const t = key => reservationLabel(language, key);
  const [day, setDay] = useState(bookingDay);
  const [guests, setGuests] = useState("2");
  const [time, setTime] = useState("");
  const [table, setTable] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [receipt, setReceipt] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("cafe_reservation") || "null"); }
    catch { return null; }
  });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!day || !guests || receipt) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ day, guests, ...(time && { time }) });
    reservationRequest("/availability?" + params, { signal: controller.signal })
      .then(setAvailability).catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason.status === 400 ? "invalid" : "error");
        if (time && reason.status === 400) { setTime(""); setTable(null); }
      });
    return () => controller.abort();
  }, [day, guests, time, receipt, revision]);

  useEffect(() => {
    try {
      if (receipt) sessionStorage.setItem("cafe_reservation", JSON.stringify(receipt));
      else sessionStorage.removeItem("cafe_reservation");
    } catch { /* The reservation can still be managed in the current page. */ }
  }, [receipt]);

  const refresh = async cancel => {
    setError("");
    try {
      const path = "/" + receipt.reservation.id + (cancel ? "/cancel" : "");
      const reservation = await reservationRequest(path, { token: receipt.token, method: cancel ? "PATCH" : "GET" });
      setReceipt({ ...receipt, reservation });
    } catch (reason) {
      if (reason.status === 403 || reason.status === 404) setReceipt(null);
      setError(reason.status === 409 ? "conflict" : "error");
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (saving || !availability?.tables?.some(item => item.number === table && item.available)) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      setReceipt(await reservationRequest("", { method: "POST", body: {
        day, time, tableNumber: table, guestCount: Number(guests), name: fields.get("name"), phone: fields.get("phone"),
      } }));
    } catch (reason) {
      setError(reason.status === 409 ? "conflict" : reason.status === 400 ? "invalid" : "error");
      if (reason.status === 409) { setTable(null); setAvailability(null); setRevision(value => value + 1); }
    } finally { setSaving(false); }
  };

  function change(setter, value, resetTime = false) {
    setter(value); setAvailability(null); setTable(null); setError("");
    if (resetTime) setTime("");
  }

  const reservation = receipt?.reservation;
  return <CafeFrame><section className="cafe-result-card">
    <h1>{t("title")}</h1>
    {error && <p role="alert" className="cafe-alert">{t(error)}</p>}
    {reservation ? <>
      <p role="status">{t(reservation.status)} · №{reservation.tableNumber}</p>
      {reservation.status === "pending" && <p>{t("expires")} · {bookingTime(reservation.holdUntil, language)} (UTC+6)</p>}
      <div className="cafe-result-actions">
        {["expired", "cancelled"].includes(reservation.status) && <button className="cafe-button cafe-button-primary" onClick={() => {
          setReceipt(null); setTime(""); setTable(null); setAvailability(null); setError("");
        }}>{t("title")}</button>}
        <button className="cafe-button cafe-button-outline" onClick={() => refresh(false)}>{t("refresh")}</button>
        {["pending", "confirmed"].includes(reservation.status) && <button className="cafe-button cafe-button-outline" onClick={() => refresh(true)}>{t("cancel")}</button>}
      </div>
    </> : <form onSubmit={submit}>
      <fieldset className="cafe-cart-fields" disabled={saving}>
        <label className="cafe-option">{t("day")}<input type="date" required min={bookingDay()} value={day} onChange={event => change(setDay, event.target.value, true)} /></label>
        <label className="cafe-option">{t("guests")}<input type="number" required min="1" max="100" value={guests} onChange={event => change(setGuests, event.target.value, true)} /></label>
        <label className="cafe-option">{t("time")} (UTC+6)<select required value={time} onChange={event => change(setTime, event.target.value)}>
          <option value="">{availability?.times.length === 0 ? t("noTimes") : t("choose")}</option>
          {[...new Set([...(availability?.times ?? []), ...(time ? [time] : [])])].map(option => <option key={option}>{option}</option>)}
        </select></label>
        {availability?.tables && <ReservationFloorPlan tables={availability.tables} label={t("layout")} seats={t("seats")} selected={table} onSelect={setTable} />}
        <label className="cafe-option">{t("name")}<input name="name" autoComplete="name" required maxLength="80" /></label>
        <label className="cafe-option">{t("phone")}<input name="phone" type="tel" autoComplete="tel" required maxLength="24" /></label>
        <button className="cafe-button cafe-button-primary" disabled={table === null}>{saving ? t("loading") : t("submit")}</button>
      </fieldset>
    </form>}
  </section></CafeFrame>;
}
