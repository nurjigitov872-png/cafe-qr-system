import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import ReservationFloorPlan from "../components/ReservationFloorPlan";
import { reservationLabel } from "../i18n/reservations";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { bookingDay, bookingTime, reservationRequest } from "../services/reservations";
import useAdminAuth from "./useAdminAuth";

export default function AdminReservations() {
  useAdminAuth();
  const { language } = useCustomerPreferences();
  const t = key => reservationLabel(language, key);
  const [day, setDay] = useState(bookingDay);
  const [calendar, setCalendar] = useState(null);
  const [table, setTable] = useState(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!day) return;
    const controller = new AbortController();
    reservationRequest("/admin/calendar?" + new URLSearchParams({ day }), { admin: true, signal: controller.signal })
      .then(setCalendar).catch(() => { if (!controller.signal.aborted) setError("error"); });
    return () => controller.abort();
  }, [day, revision]);

  const update = async (id, status) => {
    setBusy(true);
    setError("");
    try { await reservationRequest("/admin/" + id, { admin: true, method: "PATCH", body: { status } }); }
    catch (reason) { setError(reason.status === 409 ? "conflict" : "error"); }
    finally { setBusy(false); setRevision(value => value + 1); }
  };

  const dailyReservations = calendar?.reservations.filter(reservation => table === null || reservation.tableNumber === table);
  return <AdminLayout title={t("calendar")} actions={<button className="pos-button pos-button--quiet" onClick={() => {
    setError(""); setRevision(value => value + 1);
  }}>{t("refresh")}</button>}>
    <section className="pos-panel">
      <label className="pos-field">{t("day")} (UTC+6)<input type="date" value={day} onChange={event => {
        setDay(event.target.value); setCalendar(null); setError("");
      }} /></label>
      {error && <p role="alert" className="pos-alert">{t(error)}</p>}
      {!calendar && !error && day && <p role="status">{t("loading")}</p>}
      {dailyReservations?.length === 0 && <p>{t("empty")}</p>}
      {dailyReservations?.map(reservation => <article className="pos-product-row" key={reservation.id}>
        <div className="pos-product-info">
          <strong>{bookingTime(reservation.startsAt, language)}–{bookingTime(reservation.endsAt, language)} · №{reservation.tableNumber}</strong>
          <small>{t("guests")} · {reservation.guestCount} · {t(reservation.status)}</small>
          {reservation.status === "pending" && <small>{t("expires")} · {bookingTime(reservation.holdUntil, language)}</small>}
          {reservation.contact && <small>{reservation.contact.name} · {reservation.contact.phone}</small>}
        </div>
        <div className="pos-row-actions">
          {reservation.status === "pending" && <button className="pos-button pos-button--primary" disabled={busy} onClick={() => update(reservation.id, "confirmed")}>{t("confirm")}</button>}
          {["pending", "confirmed"].includes(reservation.status) && <button className="pos-button pos-button--quiet" disabled={busy} onClick={() => update(reservation.id, "cancelled")}>{t("cancel")}</button>}
        </div>
      </article>)}
    </section>
    {calendar && <section className="pos-panel">
      <h2>{t("layout")}</h2>
      <ReservationFloorPlan admin label={t("layout")} seats={t("seats")} selected={table}
        onSelect={number => setTable(value => value === number ? null : number)} tables={calendar.tables.map(table => ({
        ...table, position: calendar.positions.find(position => position.number === table.number),
      }))} />
    </section>}
  </AdminLayout>;
}
