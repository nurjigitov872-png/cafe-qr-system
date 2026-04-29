import React from "react";
import QRCode from "react-qr-code";
import AdminLayout from "../components/AdminLayout";
import useAdminAuth from "./useAdminAuth";
export default function AdminTables() {
  useAdminAuth();
  const tables = Array.from({ length:12 }, (_,i)=>i+1);
  const base = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  return <AdminLayout title="Tables QR"><div className="toolbar"><button className="small-btn" onClick={()=>window.print()}>Print / Save PDF</button></div><div className="qr-grid">{tables.map((table)=>{ const url=`${base}/table/${table}`; return <div className="card qr-card" key={table}><h3>Стол №{table}</h3><QRCode value={url} size={150} /><p className="muted qr-url">{url}</p></div>; })}</div></AdminLayout>;
}
