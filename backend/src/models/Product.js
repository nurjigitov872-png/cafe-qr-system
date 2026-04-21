const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    available: { type: Boolean, default: true },
    hidden: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    discountPrice: { type: Number, default: null },
    options: [
      {
        name: String,
        values: [String],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);