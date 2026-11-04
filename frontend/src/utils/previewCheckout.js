import { productPrice } from "./customerData.js";
// Pure browser-only validation. No API imports, persistence or network access.
export function validatePreviewCheckout({ enabled, tableId, items, products, totalAmount, orderType, paymentMethod, comment = "" }) {
  const fail = error => ({ valid: false, error });
  if (enabled !== true) return fail("Тесттик ырастоо preview режиминде гана жеткиликтүү.");
  const table = Number(tableId);
  if (!Number.isSafeInteger(table) || table < 1) return fail("Стол номери туура эмес. QR шилтемесин текшериңиз.");
  if (!Array.isArray(items) || !items.length) return fail("Себет бош. Адегенде товар кошуңуз.");
  if (!Array.isArray(products) || !products.length) return fail("Меню жүктөлө элек. Кайра аракет кылыңыз.");
  let sum = 0;
  const normalized = [];
  for (const item of items) {
    const product = products.find(product => product._id === item.productId);
    if (!product || item.name !== product.name) return fail("Себеттеги товар менюда жок. Аны кайра кошуңуз.");
    if (!Number.isSafeInteger(item.qty) || item.qty < 1) return fail("Товардын саны оң бүтүн сан болушу керек.");
    const price = productPrice(product);
    if (!Number.isFinite(item.price) || item.price < 0 || !Number.isFinite(price) || item.price !== price) return fail("Товардын баасы дал келбейт. Аны кайра кошуңуз.");
    const selected = item.selectedOptions || {};
    if (typeof selected !== "object" || Array.isArray(selected)) return fail("Товар варианты туура эмес тандалган.");
    const options = product.options || [];
    for (const option of options) if (option.values?.length && !selected[option.name]) return fail("Товардын бардык варианттарын тандап, кайра кошуңуз.");
    for (const [name,value] of Object.entries(selected)) {
      const option = options.find(option => option.name === name);
      if (!option || !option.values.includes(value)) return fail("Товар варианты туура эмес тандалган.");
    }
    sum += price * item.qty;
    normalized.push({ _id: item._id, productId: product._id, name: product.name, price, qty: item.qty, selectedOptions: { ...selected }, productSnapshot: structuredClone(product) });
  }
  if (!Number.isFinite(sum) || !Number.isFinite(totalAmount) || totalAmount < 0 || Math.abs(sum - totalAmount) > 0.005) return fail("Жалпы сумма туура эмес. Себетти кайра текшериңиз.");
  if (!["dinein","takeaway"].includes(orderType) || !["cash","online"].includes(paymentMethod) || typeof comment !== "string") return fail("Заказдын түрүн жана төлөм ыкмасын текшериңиз.");
  return { valid: true, checkout: { mock: true, tableNumber: table, items: normalized, totalAmount: sum, orderType, paymentMethod, comment } };
}
