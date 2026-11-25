const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { pickupEnabled, pickupOrderView } = require("../utils/pickup");
const { InvalidOrder, priceOrder } = require("../utils/orderPricing");
const { requireAdmin, requireOrderAccess, signToken, getSecret } = require("../middleware/auth");
const { sendOrderNotification } = require("../utils/telegram");

router.get("/dashboard/stats", requireAdmin, async (req, res) => {
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
    console.error("DASHBOARD ERROR:");
    res.status(500).json({ message: "Статистика алуу катасы" });
  }
});

router.get("/", requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("GET ORDERS ERROR:");
    res.status(500).json({ message: "Заказдарды алуу катасы" });
  }
});

router.get("/:id", requireOrderAccess, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    if (order.channel === "pickup") {
      res.set("Cache-Control", "no-store");
      if (!pickupEnabled() || !req.app.get("pickupReady")) return res.status(404).json({ message: "Заказ табылган жок" });
      const owner = req.auth.role === "customer";
      const ready = owner && order.status === "ready"
        ? await Order.findOne({ _id: order._id, channel: "pickup", status: "ready" }).select("+pickupCode")
        : null;
      return res.json(pickupOrderView(ready || order, Boolean(ready)));
    }
    res.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:");
    res.status(500).json({ message: "Заказды алуу катасы" });
  }
});

router.post("/", async (req, res) => {
  try {
    getSecret();
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return res.status(400).json({ message: "Корзина бош" });
    }

    const { items: cleanItems, totalAmount } = await priceOrder(items);

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
      io.to(["admin", "kitchen", "waiter"]).emit("order:new", order);
      io.to(["admin", "kitchen", "waiter"]).emit("new-order", order);
    }

    await req.app.get("notifications")?.publish("order.new", order);

    // Notification failure must not turn a saved order into an HTTP error.
    await sendOrderNotification(order);

    const orderToken = signToken({ role: "customer" }, order._id);
    res.status(201).json({ success: true, order, orderToken });
  } catch (error) {
    if (error instanceof InvalidOrder) return res.status(400).json({ message: "Товар, саны же параметрлери жараксыз" });
    console.error("ORDER CREATE ERROR:");
    res.status(500).json({ message: "Заказ түзүү катасы" });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
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

    // Keep the existing QR status update atomic and route Pickup through its own transitions.
    let changed = await Order.findOneAndUpdate(
      { _id: req.params.id, channel: { $ne: "pickup" }, status: { $ne: status } },
      { status },
      { new: true },
    );
    const current = changed || await Order.findById(req.params.id);
    if (current?.channel === "pickup") {
      if (!pickupEnabled() || !req.app.get("pickupReady")) return res.sendStatus(404);
      if (status === current.status) return res.json(current);
      const transitions = { pending: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["cancelled"] };
      if (!transitions[current.status]?.includes(status)) return res.status(409).json({ message: "Pickup status transition rejected" });
      changed = await Order.findOneAndUpdate(
        { _id: req.params.id, channel: "pickup", status: current.status },
        { $set: { status }, ...(status === "cancelled" && { $unset: { pickupContact: 1 } }) },
        { new: true },
      );
      if (!changed) return res.status(409).json({ message: "Pickup status changed" });
    }
    const order = changed || current;

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    if (!changed) return res.json(order);
    const io = req.app.get("io");
    if (io) {
      const pickup = order.channel === "pickup";
      const staff = pickup ? ["admin", "kitchen"] : ["admin", "kitchen", "waiter"];
      const eventOrder = pickup ? pickupOrderView(order) : order;
      io.to(staff).emit("order:updated", eventOrder);
      io.to(staff).emit("order-updated", eventOrder);
    }

    await req.app.get("notifications")?.publish("order.status", order);
    res.json(order);
  } catch (error) {
    console.error("ORDER STATUS ERROR:");
    res.status(500).json({ message: "Статус өзгөртүү катасы" });
  }
});

router.patch("/:id/cancel", requireOrderAccess, async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "pending",
        ...(!pickupEnabled() || !req.app.get("pickupReady") ? { channel: { $ne: "pickup" } } : {}) },
      { $set: { status: "cancelled" }, $unset: { pickupContact: 1 } },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Заказ табылган жок" });
    }

    const io = req.app.get("io");
    if (io) {
      const pickup = order.channel === "pickup";
      const staff = pickup ? ["admin", "kitchen"] : ["admin", "kitchen", "waiter"];
      const eventOrder = pickup ? pickupOrderView(order) : order;
      io.to(staff).emit("order:updated", eventOrder);
      io.to(staff).emit("order-updated", eventOrder);
    }

    await req.app.get("notifications")?.publish("order.status", order);
    res.json(order);
  } catch (error) {
    console.error("ORDER CANCEL ERROR:");
    res.status(500).json({ message: "Заказды отмена кылуу катасы" });
  }
});

module.exports = router;