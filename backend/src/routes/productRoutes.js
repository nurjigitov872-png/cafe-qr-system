const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");
const { buildTranslationUpdate, TranslationValidationError } = require("../utils/productTranslations");

// Бардык продукттар
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Продукттарды алуу катасы" });
  }
});

// Бир продукт
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

// Кошуу
router.post("/", requireAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: "Продукт кошуу катасы" });
  }
});

// Өзгөртүү
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Продукт табылган жок" });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: "Продукт жаңыртуу катасы" });
  }
});

// Өчүрүү
router.delete("/:id", requireAdmin, async (req, res) => {
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

// Translation-only updates cannot change IDs, prices, images or original option values.
router.patch("/:id/translations", requireAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    const { update, arrayFilters } = buildTranslationUpdate(product, req.body);
    const updated = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true, runValidators: true, ...(arrayFilters.length ? { arrayFilters } : {}),
    });
    if (!updated) return res.status(404).json({ message: "Product not found" });
    return res.json(updated);
  } catch (error) {
    if (error instanceof TranslationValidationError || ["ValidationError", "CastError"].includes(error.name)) {
      return res.status(400).json({ message: "Invalid product translations" });
    }
    return res.status(500).json({ message: "Could not save product translations" });
  }
});

module.exports = router;