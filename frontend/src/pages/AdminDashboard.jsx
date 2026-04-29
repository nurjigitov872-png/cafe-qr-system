import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { fetchDashboard } from "../services/api";
import useAdminAuth from "./useAdminAuth";

export default function AdminDashboard() {
  useAdminAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData({
          todayOrdersCount: 0,
          todayRevenue: 0,
          totalByStatus: {
            pending: 0,
            preparing: 0,
            ready: 0,
            served: 0,
            cancelled: 0,
          },
          popularProducts: [],
        });
      });
  }, []);

  return (
    <AdminLayout title="Dashboard">
      {error && <div className="error-box">{error}</div>}

      {!data ? (
        <div className="loading-box">Жүктөлүп жатат...</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Бүгүнкү заказдар</span>
              <strong>{data.todayOrdersCount || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Бүгүнкү киреше</span>
              <strong>{data.todayRevenue || 0} сом</strong>
            </div>

            <div className="stat-card">
              <span>Pending</span>
              <strong>{data.totalByStatus?.pending || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Preparing</span>
              <strong>{data.totalByStatus?.preparing || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Ready</span>
              <strong>{data.totalByStatus?.ready || 0}</strong>
            </div>

            <div className="stat-card">
              <span>Served</span>
              <strong>{data.totalByStatus?.served || 0}</strong>
            </div>
          </div>

          <div className="card">
            <h3>Popular products</h3>

            <div className="list-box">
              {(data.popularProducts || []).length ? (
                data.popularProducts.map((item) => (
                  <div className="line-row" key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.qty}</strong>
                  </div>
                ))
              ) : (
                <p>Азырынча маалымат жок</p>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}