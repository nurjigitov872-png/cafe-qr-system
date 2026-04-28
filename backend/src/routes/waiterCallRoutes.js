const express = require("express");
const router = express.Router();
const WaiterCall = require("../models/WaiterCall");

router.get("/", async (req, res) => {
  try {
    const calls = await WaiterCall.find().sort({ createdAt: -1 });
    res.json(calls);
  } catch (error) {
    res.status(500).json({ message: "Официант чакырууларын алуу катасы" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { tableNumber } = req.body;

    const call = await WaiterCall.create({
      tableNumber,
      status: "pending",
    });

    const io = req.app.get("io");
    if (io) io.emit("waiter-call", call);

    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ message: "Официант чакыруу катасы" });
  }
});

router.patch("/:id/done", async (req, res) => {
  try {
    const call = await WaiterCall.findByIdAndUpdate(
      req.params.id,
      { status: "done" },
      { new: true }
    );

    if (!call) {
      return res.status(404).json({ message: "Чакыруу табылган жок" });
    }

    const io = req.app.get("io");
    if (io) io.emit("waiter-call-updated", call);

    res.json(call);
  } catch (error) {
    res.status(500).json({ message: "Чакыруу жабуу катасы" });
  }
});

module.exports = router;