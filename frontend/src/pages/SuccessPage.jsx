import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function SuccessPage() {
  const { state } = useLocation();

  return (
    <div className="success-page">
      <div className="success-card">
        <h1>Онлайн төлөм аяктады</h1>

        <p>Order ID: {state?.orderId || "-"}</p>
        <p>Заказ ийгиликтүү кабыл алынды</p>
        <p>Заказды көрүү үчүн башкы менюга кайтыңыз</p>

        <Link to={`/table/${state?.tableId || 1}`} className="back-link">
          Башкы меню
        </Link>
      </div>
    </div>
  );
}