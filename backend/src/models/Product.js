const mongoose = require("mongoose");

const localizedText = new mongoose.Schema({
  name: { type: String, maxlength: 200 },
  description: { type: String, maxlength: 4000 },
  category: { type: String, maxlength: 120 },
}, { _id: false });
const optionLabel = new mongoose.Schema({
  name: { type: String, maxlength: 200 },
  values: [{ _id: false, value: { type: String, required: true }, label: { type: String, maxlength: 200 } }],
}, { _id: false });
const locales = schema => ({ ky: { type: schema }, ru: { type: schema }, en: { type: schema }, tr: { type: schema } });

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
    translations: locales(localizedText),
    options: [
      {
        name: String,
        values: [String],
        translations: locales(optionLabel),
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);