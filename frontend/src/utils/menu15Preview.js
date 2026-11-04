export function isMenu15Preview(search, development, hostname) {
  return development === true && ["localhost", "127.0.0.1", "[::1]"].includes(hostname) && new URLSearchParams(search).get("preview") === "menu15";
}
export function buildMenu15Preview(liveProducts, manifest) {
  const entries = manifest.products;
  if (!Array.isArray(entries) || entries.length !== 15 || new Set(entries.map(entry => entry.productId)).size !== 15) throw new Error("Invalid menu selection");
  for (const group of ["Food", "Drink", "Dessert"]) if (entries.filter(entry => entry.selectionGroup === group).length !== 5) throw new Error("Invalid category counts");
  return entries.map(entry => {
    const live = liveProducts.find(product => String(product._id) === entry.productId);
    const source = entry.source;
    if (!live || live.hidden || live.available === false || !live.image || ["name", "category", "price", "image"].some(field => live[field] !== source[field]) || (live.description || "") !== source.description) throw new Error("Preview source changed; review selection again");
    // Legacy APIs may synthesize option IDs on each read. Match option labels/values,
    // then preserve the option IDs returned by the CURRENT API response unchanged.
    if ((live.options || []).length !== source.options.length) throw new Error("Preview options changed");
    const options = (live.options || []).map((option,index) => {
      const original = source.options[index];
      if (option.name !== original.name || JSON.stringify(option.values) !== JSON.stringify(original.values)) throw new Error("Preview options changed");
      return { ...option, translations: structuredClone(entry.proposed.options[index].translations) };
    });
    for (const [name,value] of Object.entries(entry.presetOptions || {})) if (!options.some(option => option.name === name && option.values.includes(value))) throw new Error("Invalid preview variant");
    return { ...live, options, translations: structuredClone(entry.proposed.translations), previewOptions: { ...(entry.presetOptions || {}) } };
  });
}
