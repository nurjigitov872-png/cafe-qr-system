import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelOrder, getOrderById } from "../services/api";

export default function MyOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);

  const loadOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const data = await getOrderById(orderId);
      setOrder(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder().catch((e) => alert(e.message));
  }, [orderId]);

  const handleCancel = async () => {
    try {
      setCancelLoading(true);
      await cancelOrder(orderId);
      await loadOrder();
    } catch (e) {
      alert(e.message);
    } finally {
      setCancelLoading(false);
    }
  };

  if (!orderId) {
    return (
      <div className="track-page">
        <div className="track-card">
          <h1>Менин заказым</h1>
          <p>Акыркы заказ табылган жок</p>
          <Link className="back-link" to="/table/1">
            Менюга өтүү
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="track-page">
        <div className="track-card">
          <h1>Менин заказым</h1>
          <p>Жүктөлүп жатат...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="track-page">
        <div className="track-card">
          <h1>Менин заказым</h1>
          <p>Заказ табылган жок</p>
          <Link className="back-link" to="/table/1">
            Менюга өтүү
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="track-page">
      <div className="track-card">
        <h1>Менин заказым</h1>

        <p>
          <strong>Стол:</strong> №{order.tableNumber}
        </p>

        <p>
          <strong>Статус:</strong>{" "}
          <span className={`status ${order.status}`}>{order.status}</span>
        </p>

        <p>
          <strong>Төлөм:</strong> {order.paymentMethod} /{" "}
          {order.paymentStatus || "pending"}
        </p>

        <div className="order-items" style={{ marginTop: "18px" }}>
          {order.items?.map((item, index) => (
            <div key={index} className="order-item-line">
              <span>
                {item.name} × {item.qty}
              </span>
              <strong>{item.price * item.qty} сом</strong>
            </div>
          ))}
        </div>

        <div className="cart-bottom" style={{ marginTop: "18px" }}>
          <h3>Жалпы: {order.totalAmount} сом</h3>
        </div>

        <div
          className="button-row"
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "18px",
          }}
        >
          {order.status === "pending" && (
            <button
              className="submit-btn"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading ? "Отмена..." : "Заказды отмена кылуу"}
            </button>
          )}

          <Link className="back-link" to={`/table/${order.tableNumber}`}>
            Менюга кайтуу
          </Link>
        </div>
      </div>
    </div>
  );
}