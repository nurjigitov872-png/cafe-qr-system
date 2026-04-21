const express = require("express");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  const { category } = req.query;

  const filter = { hidden: false, available: true };
  if (category) filter.category = category;

  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json(products);
});

router.post("/", auth, async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

router.put("/:id", auth, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(product);
});

router.delete("/:id", auth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;