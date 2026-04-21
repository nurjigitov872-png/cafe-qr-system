const express = require("express");
const WaiterCall = require("../models/WaiterCall");
const auth = require("../middleware/auth");
const { sendTelegramMessage } = require("../utils/telegram");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const calls = await WaiterCall.find().sort({ createdAt: -1 });
  res.json(calls);
});

router.post("/", async (req, res) => {
  const call = await WaiterCall.create({
    tableNumber: req.body.tableNumber,
  });

  const io = req.app.get("io");
  io.emit("waiter:new", call);

  await sendTelegramMessage(`🔔 Официант чакырылды. Стол: ${call.tableNumber}`);

  res.status(201).json(call);
});

router.patch("/:id/done", auth, async (req, res) => {
  const call = await WaiterCall.findByIdAndUpdate(
    req.params.id,
    { status: "done" },
    { new: true }
  );

  if (!call) return res.status(404).json({ message: "Call not found" });

  res.json(call);
});

module.exports = router;