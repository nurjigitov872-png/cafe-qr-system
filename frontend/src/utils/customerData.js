export const customerMoney = value => new Intl.NumberFormat("ky-KG", { maximumFractionDigits: 2 }).format(Number(value) || 0) + " сом";
export const productPrice = product => typeof product.discountPrice === "number" && product.discountPrice > 0 ? product.discountPrice : Number(product.price);
export const orderPayload = (tableId, items, comment, orderType, paymentMethod) => ({
  tableNumber: Number(tableId) || 1,
  items: items.map(item => ({ productId: item.productId, name: item.name, price: Number(item.price), qty: Number(item.qty), selectedOptions: { ...(item.selectedOptions || {}) } })),
  totalAmount: items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0),
  comment: comment || "", orderType: orderType === "dinein" ? "dinein" : "takeaway", paymentMethod: paymentMethod === "online" ? "online" : "cash",
});
