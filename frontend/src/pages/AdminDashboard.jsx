import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { fetchDashboard } from "../services/api";
import useAdminAuth from "./useAdminAuth";
export default function AdminDashboard() {
  useAdminAuth();
  const [data, setData] = useState(null);
  useEffect(() => { fetchDashboard().then(setData).catch((e) => alert(e.message)); }, []);
  return <AdminLayout title="Dashboard">{!data ? <div className="loading-box">Жүктөлүп жатат...</div> : <>
    <div className="stats-grid">
      <div className="stat-card"><span>Бүгүнкү заказдар</span><strong>{data.todayOrdersCount}</strong></div>
      <div className="stat-card"><span>Бүгүнкү киреше</span><strong>{data.todayRevenue} сом</strong></div>
      <div className="stat-card"><span>Pending</span><strong>{data.totalByStatus.pending}</strong></div>
      <div className="stat-card"><span>Preparing</span><strong>{data.totalByStatus.preparing}</strong></div>
      <div className="stat-card"><span>Ready</span><strong>{data.totalByStatus.ready}</strong></div>
      <div className="stat-card"><span>Served</span><strong>{data.totalByStatus.served}</strong></div>
    </div>
    <div className="card"><h3>Popular products</h3><div className="list-box">{data.popularProducts.map((item)=><div className="line-row" key={item.name}><span>{item.name}</span><strong>{item.qty}</strong></div>)}</div></div>
  </>}</AdminLayout>;
}
