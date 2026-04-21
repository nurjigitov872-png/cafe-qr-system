const express = require("express");
const Order = require("../models/Order");
const auth = require("../middleware/auth");
const { sendTelegramMessage } = require("../utils/telegram");

const router = express.Router();

function normalizeOrderType(value) {
  if (!value) return "dinein";

  const map = {
    dinein: "dinein",
    dine_in: "dinein",
    inhall: "dinein",
    hall: "dinein",
    takeaway: "takeaway",
    takeout: "takeaway",
    togo: "takeaway",
    delivery: "delivery",
  };

  return map[String(value).toLowerCase()] || "dinein";
}

function normalizePaymentMethod(value) {
  if (!value) return "cash";
  return String(value).toLowerCase() === "online" ? "online" : "cash";
}

router.get("/", auth, async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json(orders);
});

router.get("/dashboard/stats", auth, async (req, res) => {
  const orders = await Order.find();

  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  res.json({
    totalOrders,
    totalRevenue,
    pending: orders.filter((o) => o.status === "pending").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
    served: orders.filter((o) => o.status === "served").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  });
});

router.get("/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
});

router.post("/", async (req, res) => {
  try {
    const items = req.body.items || [];
    const totalAmount =
      req.body.totalAmount ||
      items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);

    const order = await Order.create({
      tableNumber: req.body.tableNumber,
      items,
      comment: req.body.comment || "",
      orderType: normalizeOrderType(req.body.orderType),
      paymentMethod: normalizePaymentMethod(req.body.paymentMethod),
      paymentStatus:
        normalizePaymentMethod(req.body.paymentMethod) === "online"
          ? "pending"
          : "pending",
      totalAmount,
    });

    const io = req.app.get("io");
    io.emit("order:new", order);

    const text = [
      `🆕 Жаңы заказ`,
      `Стол: ${order.tableNumber}`,
      `Тип: ${order.orderType}`,
      `Төлөм: ${order.paymentMethod}`,
      `Сумма: ${order.totalAmount} сом`,
      `Комментарий: ${order.comment || "-"}`,
      `Товарлар:`,
      ...order.items.map((i) => `- ${i.name} x${i.qty}`),
    ].join("\n");

    await sendTelegramMessage(text);

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id/status", auth, async (req, res) => {
  const { status } = req.body;

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!order) return res.status(404).json({ message: "Order not found" });

  const io = req.app.get("io");
  io.emit("order:updated", order);

  res.json(order);
});

router.patch("/:id/cancel", async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );

  if (!order) return res.status(404).json({ message: "Order not found" });

  const io = req.app.get("io");
  io.emit("order:updated", order);

  res.json(order);
});

module.exports = router;