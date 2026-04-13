import React from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") || "";

  return (
    <div className="success-page">
      <div className="success-card">
        <h1>💳 Онлайн төлөм аяктады</h1>

        <p className="success-text">
          Сиздин заказ ийгиликтүү кабыл алынды
        </p>

        {orderId && (
          <p className="order-id">
            Order ID: <strong>{orderId}</strong>
          </p>
        )}

        <div className="success-buttons">
          {orderId && (
            <Link className="success-btn primary" to={`/my-order/${orderId}`}>
              📦 Заказды көрүү
            </Link>
          )}

          <Link className="success-btn secondary" to="/table/1">
            🍔 Башкы меню
          </Link>
        </div>
      </div>
    </div>
  );
}