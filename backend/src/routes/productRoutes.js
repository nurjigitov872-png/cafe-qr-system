const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Бардык продукттарды алуу
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Продукттарды алуу катасы" });
  }
});

// Бир продукт алуу
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Продукт табылган жок" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Продуктту алуу катасы" });
  }
});

// Жаңы продукт кошуу
router.post("/", async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: "Продукт кошуу катасы" });
  }
});

// Продукт жаңыртуу
router.put("/:id", async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Продукт табылган жок" });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: "Продукт жаңыртуу катасы" });
  }
});

// Продукт өчүрүү
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Продукт табылган жок" });
    }

    res.json({ message: "Продукт өчүрүлдү" });
  } catch (error) {
    res.status(500).json({ message: "Продукт өчүрүү катасы" });
  }
});

module.exports = router;