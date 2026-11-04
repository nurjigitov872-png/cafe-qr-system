const LANGUAGES = ["ky", "ru", "en", "tr"];
class TranslationValidationError extends Error {}
const invalid = () => { throw new TranslationValidationError("Invalid product translations"); };
const object = value => value && typeof value === "object" && !Array.isArray(value);
function text(value, max) { if (typeof value !== "string" || value.length > max) invalid(); return value.trim(); }
function cleanLocales(input, option) {
  if (!object(input) || Object.keys(input).some(key => !LANGUAGES.includes(key))) invalid();
  const result = {};
  for (const [language, value] of Object.entries(input)) {
    if (!object(value)) invalid();
    const allowed = option ? ["name", "values"] : ["name", "description", "category"];
    if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
    const locale = {};
    for (const [field, content] of Object.entries(value)) {
      if (field === "values") {
        if (!Array.isArray(content)) invalid();
        const seen = new Set();
        locale.values = content.map(entry => {
          if (!object(entry) || Object.keys(entry).some(key => !["value", "label"].includes(key))) invalid();
          if (typeof entry.value !== "string" || !option.values.includes(entry.value) || seen.has(entry.value)) invalid();
          seen.add(entry.value); return { value: entry.value, label: text(entry.label, 200) };
        });
      } else locale[field] = text(content, field === "description" ? 4000 : field === "category" ? 120 : 200);
    }
    result[language] = locale;
  }
  return result;
}
function buildTranslationUpdate(product, body) {
  if (!object(body) || Object.keys(body).some(key => !["translations", "options"].includes(key))) invalid();
  const $set = {}, arrayFilters = [];
  const assign = (prefix, locales, option) => {
    for (const [language, fields] of Object.entries(cleanLocales(locales, option))) {
      for (const [field, value] of Object.entries(fields)) $set[prefix + "." + language + "." + field] = value;
    }
  };
  if (body.translations !== undefined) assign("translations", body.translations);
  if (body.options !== undefined) {
    if (!Array.isArray(body.options)) invalid();
    const seen = new Set();
    body.options.forEach((entry, index) => {
      if (!object(entry) || Object.keys(entry).some(key => !["optionId", "translations"].includes(key)) || typeof entry.optionId !== "string" || seen.has(entry.optionId)) invalid();
      const option = (product.options || []).find(item => String(item._id) === entry.optionId);
      if (!option) invalid();
      seen.add(entry.optionId);
      const prefix = "options.$[option" + index + "].translations";
      const before = Object.keys($set).length;
      assign(prefix, entry.translations, option);
      if (Object.keys($set).length > before) arrayFilters.push({ ["option" + index + "._id"]: option._id });
    });
  }
  if (!Object.keys($set).length) invalid();
  return { update: { $set }, arrayFilters };
}
module.exports = { buildTranslationUpdate, TranslationValidationError };
