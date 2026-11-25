import React, { useState } from "react";
import { kitchenLabel } from "../i18n/kitchen";
import { updatePreparationTime } from "../services/api";
import { formatDate } from "../utils/adminData";

const presets = [15, 20, 30, 45, 60];

export default function PreparationEstimate({ order, language, onSaved }) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!["pending", "preparing"].includes(order.status)) return null;
  const t = key => kitchenLabel(language, key);
  const submit = async event => {
    event.preventDefault();
    if (busy || !choice) return;
    setBusy(true);
    setError(false);
    try {
      const updated = await updatePreparationTime(order._id, Number(choice === "custom" ? custom : choice));
      onSaved(updated);
      setChoice("");
      setCustom("");
    } catch { setError(true); }
    finally { setBusy(false); }
  };

  return <form onSubmit={submit}>
    {order.estimatedReadyAt && <p className="pos-order-payment">{t("estimate")} · {formatDate(order.estimatedReadyAt)}</p>}
    <label className="pos-field">{t("select")}
      <select value={choice} disabled={busy} onChange={event => setChoice(event.target.value)}>
        <option value="">{t("select")}</option>
        {presets.map(minutes => <option key={minutes} value={minutes}>{minutes} {t("minutes").toLocaleLowerCase(language)}</option>)}
        <option value="custom">{t("custom")}</option>
      </select>
    </label>
    {choice === "custom" && <label className="pos-field">{t("minutes")}
      <input type="number" min="1" max="240" step="1" required value={custom} disabled={busy} onChange={event => setCustom(event.target.value)} />
    </label>}
    {choice && <button type="submit" className="pos-button pos-button--quiet" disabled={busy}>{t("save")}</button>}
    {error && <p role="alert">{t("error")}</p>}
  </form>;
}
