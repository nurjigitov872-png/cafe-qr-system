import React from "react";
import QRCode from "react-qr-code";
import AdminLayout from "../components/AdminLayout";
import { Icon } from "../components/AdminUI";
import useAdminAuth from "./useAdminAuth";
export default function AdminTables() {
  useAdminAuth();
  const tables = Array.from({ length: 12 }, (_, index) => index + 1);
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, "");
  return <AdminLayout title="Столдордун QR-коддору" subtitle="Ар бир стол үчүн менюга түз өтүүчү QR-код." actions={<button className="pos-button pos-button--primary" onClick={() => window.print()}><Icon name="print" />Басып чыгаруу / PDF</button>}><div className="pos-qr-grid">{tables.map(table => { const url = base + "/table/" + table; return <article className="pos-panel pos-qr-card" key={table}><h2>Стол №{table}</h2><p>Менюну ачуу үчүн скандаңыз</p><div className="pos-qr-code"><QRCode value={url} size={150} /></div><a className="pos-qr-url" href={url} target="_blank" rel="noreferrer">{url}</a></article>; })}</div></AdminLayout>;
}
