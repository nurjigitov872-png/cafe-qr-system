export const PRODUCT_LANGUAGES = [{ code: "ky", label: "Кыргызча" }, { code: "ru", label: "Русский" }, { code: "en", label: "English" }, { code: "tr", label: "Türkçe" }];
export const optionText = options => (options || []).map(option => option.name + ":" + (option.values || []).join(",")).join(";");
export function parseProductOptions(text, original = []) {
  if (text === optionText(original)) return original.map(option => ({ ...option, values: [...option.values] }));
  return text ? text.split(";").map(item => {
    const [name, values] = item.split(":"); const key = (name || "").trim();
    const existing = original.find(option => option.name === key);
    return { ...(existing || {}), name: key, values: (values || "").split(",").map(value => value.trim()).filter(Boolean) };
  }).filter(option => option.name) : [];
}
export function productTranslationState(product = {}) {
  return { translations: structuredClone(product.translations || {}), options: (product.options || []).map(option => ({ optionId: String(option._id || ""), name: option.name, translations: structuredClone(option.translations || {}) })) };
}
export function translationPatch(state) {
  return { translations: state.translations, options: state.options.filter(option => option.optionId && Object.keys(option.translations || {}).length).map(option => ({ optionId: option.optionId, translations: option.translations })) };
}
export function attachOptionTranslations(options, state) {
  return options.map(option => {
    const match = state.options.find(entry => option._id ? entry.optionId === String(option._id) : entry.name === option.name);
    return match ? { ...option, translations: match.translations } : option;
  });
}
export function reviewSource(product) {
  return { productId: String(product._id), name: product.name, description: product.description || "", category: product.category,
    price: product.price, image: product.image || "", options: (product.options || []).map(option => ({ optionId: String(option._id), name: option.name, values: [...option.values] })) };
}
export function readTranslationProposal(manifest, product) {
  if (manifest?.format !== "cafe-product-translations-v1" || !Array.isArray(manifest.products)) throw new Error("Invalid translation draft");
  const entry = manifest.products.find(item => item.productId === String(product._id));
  if (!entry || JSON.stringify(entry.source) !== JSON.stringify(reviewSource(product))) throw new Error("Draft source differs from current product");
  return { translations: structuredClone(entry.proposed.translations), options: (entry.proposed.options || []).map(option => ({ ...option, name: product.options.find(item => String(item._id) === option.optionId)?.name || "" })) };
}
