import React from "react";
import { STATUS_LABELS } from "../utils/adminData";
const paths = {
 dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 orders: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6 M9 15h3",
 products: "m3 7 9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10",
 kitchen: "M5 10h14v10H5z M8 10V8a4 4 0 0 1 8 0v2 M3 14h2 M19 14h2",
 waiter: "M3 16h18 M5 16a7 7 0 0 1 14 0 M12 7V5 M10 5h4 M7 20h10",
 qr: "M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h2v2h-2z M19 15h2v6h-6v-2",
 logout: "M9 4H4v16h5 M10 12h11 m-4-4 4 4-4 4",
 menu: "M4 6h16 M4 12h16 M4 18h16", close: "m6 6 12 12 M6 18 18 6",
 arrow: "M4 12h16 m-6-6 6 6-6 6", chevron: "m9 5 7 7-7 7",
 clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
 check: "m5 12 4 4L19 6", money: "M3 6h18v12H3z M7 10v4 M17 10v4 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
 search: "M15 15l6 6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
 refresh: "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 2 M4 17l2 2a8 8 0 0 0 13-3",
 plus: "M12 5v14 M5 12h14", edit: "m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
 trash: "M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
 print: "M7 8V3h10v5 M7 17H3V8h18v9h-4 M7 14h10v7H7z",
 chart: "M4 4v16h17 M8 15l4-5 4 2 5-7", lock: "M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3",
 alert: "M12 3 2 21h20z M12 9v5 M12 17v1", table: "M3 6h18v5H3z M5 11v9 M19 11v9 M8 16h8"
};
export function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.orders} /></svg>; }
export function StatusBadge({ status }) { return <span className={"pos-status pos-status--" + status}><span />{STATUS_LABELS[status] || "Белгисиз"}</span>; }
export function EmptyState({ title = "Маалымат жок", detail = "Жаңы маалымат келгенде ушул жерде көрсөтүлөт.", icon = "orders" }) { return <div className="pos-empty"><span className="pos-empty-icon"><Icon name={icon} size={24} /></span><strong>{title}</strong><p>{detail}</p></div>; }
export function DataNotice({ loading, error, onRetry }) { if (error) return <div className="pos-alert" role="alert"><Icon name="alert" /><span>{error}</span>{onRetry && <button className="pos-button pos-button--quiet" onClick={onRetry}>Кайра аракет кылуу</button>}</div>; if (loading) return <div className="pos-loading" role="status"><span className="pos-spinner" />Маалымат жүктөлүүдө…</div>; return null; }
export function RefreshButton({ loading, onClick }) { return <button className="pos-button pos-button--quiet" onClick={onClick} disabled={loading}><Icon name="refresh" />Жаңыртуу</button>; }
