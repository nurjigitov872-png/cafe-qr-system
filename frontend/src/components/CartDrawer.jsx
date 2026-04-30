import React from "react";

export default function CartDrawer({
  cartItems,
  note,
  setNote,
  onIncrease,
  onDecrease,
  onRemove,
  totalAmount,
  onSubmit,
  loading,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  onClose,
}) {
  return (
    <div className="cart-drawer">
      <button type="button" className="cart-close-btn" onClick={onClose}>
        ×
      </button>

      <h2>🛒 Ваш заказ</h2>

      <div className="order-type">
        <label className={orderType === "dinein" ? "active" : ""}>
          <input
            type="radio"
            name="orderType"
            checked={orderType === "dinein"}
            onChange={() => setOrderType("dinein")}
          />
          <span>🍽 В зале</span>
        </label>

        <label className={orderType === "takeaway" ? "active" : ""}>
          <input
            type="radio"
            name="orderType"
            checked={orderType === "takeaway"}
            onChange={() => setOrderType("takeaway")}
          />
          <span>🥡 С собой</span>
        </label>
      </div>

      <div className="payment-methods">
        <label className={paymentMethod === "cash" ? "active" : ""}>
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "cash"}
            onChange={() => setPaymentMethod("cash")}
          />
          <span>💵 Наличными</span>
        </label>

        <label className={paymentMethod === "online" ? "active" : ""}>
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "online"}
            onChange={() => setPaymentMethod("online")}
          />
          <span>💳 Онлайн оплата</span>
        </label>
      </div>

      {cartItems.length === 0 ? (
        <p className="empty">Корзина пуста</p>
      ) : (
        <>
          <div className="cart-list">
            {cartItems.map((item) => (
              <div className="cart-item" key={item._id}>
                <div className="item-info">
                  <h4>{item.name}</h4>
                  <p>
                    {item.price} сом × {item.qty}
                  </p>
                </div>

                <div className="qty-box">
                  <button type="button" onClick={() => onDecrease(item._id)}>
                    -
                  </button>
                  <span>{item.qty}</span>
                  <button type="button" onClick={() => onIncrease(item._id)}>
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => onRemove(item._id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <textarea
            placeholder="Комментарий к заказу..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="cart-bottom">
            <h3>{totalAmount} сом</h3>

            <button
              type="button"
              className="submit-btn"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? "⏳ Отправка..." : "🚀 Оформить заказ"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}