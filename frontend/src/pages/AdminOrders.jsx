import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { fetchOrders, updateOrderStatus } from "../services/api";
import { socket } from "../services/socket";
import useAdminAuth from "./useAdminAuth";

export default function AdminOrders() {
  useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    const data = await fetchOrders(
      statusFilter ? { status: statusFilter } : {}
    );
    setOrders(data);
  };

  useEffect(() => {
    load().catch((e) => alert(e.message));
  }, [statusFilter]);

  useEffect(() => {
    const handler = () => {
      load().catch(console.error);
    };

    socket.on("order:new", handler);
    socket.on("order:updated", handler);

    return () => {
      socket.off("order:new", handler);
      socket.off("order:updated", handler);
    };
  }, []);

  const changeStatus = async (id, status) => {
    await updateOrderStatus(id, status);
    await load();
  };

  return (
    <AdminLayout title="Orders">
      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="preparing">preparing</option>
          <option value="ready">ready</option>
          <option value="served">served</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>

      <div className="admin-cards-grid">
        {orders.map((order) => (
          <div className="card" key={order._id}>
            <div className="line-row">
              <h3>Стол №{order.tableNumber}</h3>
              <span className={`status-badge ${order.status}`}>
                {order.status}
              </span>
            </div>

            <div className="muted">
              {new Date(order.createdAt).toLocaleString()}
            </div>

            <div className="list-box">
              {order.items.map((item, index) => (
                <div className="line-row" key={index}>
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <strong>{item.price * item.qty} сом</strong>
                </div>
              ))}
            </div>

            <p>
              <b>Комментарий:</b> {order.comment || "-"}
            </p>
            <p>
              <b>Тип:</b> {order.orderType}
            </p>
            <p>
              <b>Төлөм:</b> {order.paymentMethod} / {order.paymentStatus}
            </p>

            <h4>Жалпы: {order.totalAmount} сом</h4>

            <div className="button-row wrap">
              {["pending", "preparing", "ready", "served", "cancelled"].map(
                (status) => (
                  <button
                    key={status}
                    className="small-btn"
                    onClick={() => changeStatus(order._id, status)}
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}