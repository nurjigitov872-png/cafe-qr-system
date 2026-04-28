const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

router.get("/dashboard/stats", async (req, res) => {
  try {
    const orders = await Order.find();

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => {
      if (order.status !== "cancelled") return sum + Number(order.totalAmount || 0);
      return sum;
    }, 0);

    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const preparingOrders = orders.filter((o) => o.status === "preparing").length;
    const readyOrders = orders.filter((o) => o.status === "ready").length;

    res.json({
      totalOrders,
      totalRevenue,
      pendingOrders,
      preparingOrders,
      readyOrders,
    });
  } catch (error) {
    res.status(500).json({ message: "Статистика алуу катасы" });
  }
});

router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Заказдарды алуу катасы" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Заказды алуу катасы" });
  }
});

router.post("/", async (req, res) => {
  try {
    const order = new Order(req.body);
    const savedOrder = await order.save();

    const io = req.app.get("io");
    if (io) io.emit("new-order", savedOrder);

    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(500).json({ message: "Заказ түзүү катасы" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    const io = req.app.get("io");
    if (io) io.emit("order-updated", order);

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Статус өзгөртүү катасы" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    const io = req.app.get("io");
    if (io) io.emit("order-updated", order);

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Заказды отмена кылуу катасы" });
  }
});

module.exports = router;