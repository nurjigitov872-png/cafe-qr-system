const Product = require("../models/Product");

class InvalidOrder extends Error {}

async function priceOrder(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) throw new InvalidOrder();
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || !/^[a-f0-9]{24}$/i.test(item.productId) ||
        !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 100) throw new InvalidOrder();
  }
  const ids = [...new Set(items.map(item => item.productId.toLowerCase()))];
  const products = await Product.find({ _id: { $in: ids }, hidden: { $ne: true }, available: { $ne: false } }).lean();
  const catalog = new Map(products.map(product => [String(product._id), product]));
  let totalMinor = 0;
  const pricedItems = items.map(item => {
    const product = catalog.get(item.productId.toLowerCase());
    if (!product || product.hidden || product.available === false) throw new InvalidOrder();
    const selectedOptions = item.selectedOptions ?? {};
    if (typeof selectedOptions !== "object" || Array.isArray(selectedOptions)) throw new InvalidOrder();
    for (const [name, value] of Object.entries(selectedOptions)) {
      if (["__proto__", "constructor", "prototype"].includes(name) || typeof value !== "string" ||
          !(product.options || []).some(option => option.name === name && option.values?.includes(value))) throw new InvalidOrder();
    }
    const price = product.discountPrice > 0 ? product.discountPrice : product.price;
    if (!Number.isFinite(price) || price < 0) throw new InvalidOrder();
    const minor = Math.round(Number(price.toFixed(2)) * 100);
    if (!Number.isSafeInteger(minor)) throw new InvalidOrder();
    totalMinor += minor * item.qty;
    if (!Number.isSafeInteger(totalMinor)) throw new InvalidOrder();
    return { productId: product._id, name: product.name, price: minor / 100, qty: item.qty, selectedOptions };
  });
  return { items: pricedItems, totalAmount: totalMinor / 100 };
}

module.exports = { InvalidOrder, priceOrder };
