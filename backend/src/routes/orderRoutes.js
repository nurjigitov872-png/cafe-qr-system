const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

router.get("/dashboard/stats", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o) => new Date(o.createdAt) >= today);

    const todayRevenue = todayOrders.reduce((sum, order) => {
      if (order.status !== "cancelled") {
        return sum + Number(order.totalAmount || 0);
      }
      return sum;
    }, 0);

    const totalByStatus = {
      pending: orders.filter((o) => o.status === "pending").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      ready: orders.filter((o) => o.status === "ready").length,
      served: orders.filter((o) => o.status === "served").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    };

    const productMap = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productMap[item.name]) productMap[item.name] = 0;
        productMap[item.name] += Number(item.qty || 0);
      });
    });

    const popularProducts = Object.entries(productMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    res.json({
      todayOrdersCount: todayOrders.length,
      todayRevenue,
      totalByStatus,
      popularProducts,
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error.message);
    res.status(500).json({ message: error.message || "Статистика алуу катасы" });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("GET ORDERS ERROR:", error.message);
    res.status(500).json({ message: error.message || "Заказдарды алуу катасы" });
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
    console.error("GET ORDER ERROR:", error.message);
    res.status(500).json({ message: error.message || "Заказды алуу катасы" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return res.status(400).json({ message: "Корзина бош" });
    }

    const cleanItems = items.map((item) => ({
      productId: item.productId || undefined,
      name: String(item.name || "Товар"),
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 1,
      selectedOptions: item.selectedOptions || {},
    }));

    const totalAmount =
      Number(body.totalAmount) ||
      cleanItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    const order = await Order.create({
      tableNumber: Number(body.tableNumber) || 1,
      items: cleanItems,
      comment: body.comment || "",
      orderType:
        body.orderType === "takeaway" || body.orderType === "delivery"
          ? body.orderType
          : "dinein",
      paymentMethod: body.paymentMethod === "online" ? "online" : "cash",
      paymentStatus: "pending",
      status: "pending",
      totalAmount,
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("order:new", order);
      io.emit("new-order", order);
    }

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("ORDER CREATE ERROR:", error.message);
    res.status(500).json({ message: error.message || "Заказ түзүү катасы" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const allowedStatuses = [
      "pending",
      "preparing",
      "ready",
      "served",
      "cancelled",
    ];

    const status = allowedStatuses.includes(req.body.status)
      ? req.body.status
      : "pending";

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("order:updated", order);
      io.emit("order-updated", order);
    }

    res.json(order);
  } catch (error) {
    console.error("ORDER STATUS ERROR:", error.message);
    res.status(500).json({ message: error.message || "Статус өзгөртүү катасы" });
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
    if (io) {
      io.emit("order:updated", order);
      io.emit("order-updated", order);
    }

    res.json(order);
  } catch (error) {
    console.error("ORDER CANCEL ERROR:", error.message);
    res.status(500).json({ message: error.message || "Заказды отмена кылуу катасы" });
  }
});

module.exports = router;