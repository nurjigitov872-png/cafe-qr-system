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
}) {
  return (
    <div className="cart-drawer">
      <h2>🛒 Ваш заказ</h2>

      {/* ORDER TYPE */}
      <div className="order-type">
        <label className={orderType === "dinein" ? "active" : ""}>
          <input
            type="radio"
            name="orderType"
            value="dinein"
            checked={orderType === "dinein"}
            onChange={() => setOrderType("dinein")}
          />
          <span>🍽 В зале</span>
        </label>

        <label className={orderType === "takeaway" ? "active" : ""}>
          <input
            type="radio"
            name="orderType"
            value="takeaway"
            checked={orderType === "takeaway"}
            onChange={() => setOrderType("takeaway")}
          />
          <span>🥡 С собой</span>
        </label>
      </div>

      {/* PAYMENT */}
      <div className="payment-methods">
        <label className={paymentMethod === "cash" ? "active" : ""}>
          <input
            type="radio"
            name="paymentMethod"
            value="cash"
            checked={paymentMethod === "cash"}
            onChange={() => setPaymentMethod("cash")}
          />
          <span>💵 Наличными</span>
        </label>

        <label className={paymentMethod === "card_online" ? "active" : ""}>
          <input
            type="radio"
            name="paymentMethod"
            value="card_online"
            checked={paymentMethod === "card_online"}
            onChange={() => setPaymentMethod("card_online")}
          />
          <span>💳 Онлайн оплата</span>
        </label>
      </div>

      {/* EMPTY */}
      {cartItems.length === 0 ? (
        <p className="empty">Корзина пуста</p>
      ) : (
        <>
          {/* ITEMS */}
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
                  <button onClick={() => onDecrease(item._id)}>-</button>
                  <span>{item.qty}</span>
                  <button onClick={() => onIncrease(item._id)}>+</button>
                </div>

                <button
                  className="remove-btn"
                  onClick={() => onRemove(item._id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* NOTE */}
          <textarea
            placeholder="Комментарий к заказу..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* TOTAL */}
          <div className="cart-bottom">
            <h3>{totalAmount} сом</h3>

            <button
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