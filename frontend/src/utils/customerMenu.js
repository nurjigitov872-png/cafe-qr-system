// Frontend-only selection. Never deletes or updates catalog records.
export const CUSTOMER_MENU = Object.freeze({ mode: "selected15", expectedCount: 15 });

export function customerMenuConfig(appEnv) {
  return appEnv === "staging" ? { mode: "all" } : CUSTOMER_MENU;
}

export function selectCustomerMenu(products, manifest, config = CUSTOMER_MENU) {
  if (config.mode === "all") return products.filter(p => !p.hidden && p.available !== false);
  const entries = manifest.products;
  if (config.mode !== "selected15" || entries?.length !== config.expectedCount || new Set(entries.map(e => e.productId)).size !== config.expectedCount) throw new Error("Invalid customer menu configuration");
  for (const category of ["Food", "Drink", "Dessert"]) if (entries.filter(e => e.selectionGroup === category).length !== 5) throw new Error("Invalid menu category selection");
  return entries.flatMap(entry => {
    const live = products.find(p => String(p._id) === entry.productId);
    if (!live || live.hidden || live.available === false) return [];
    // Current API values always win. Draft labels are safe only for matching text.
    const translations = {};
    for (const lang of ["ky", "ru", "en", "tr"]) {
      translations[lang] = {};
      for (const field of ["name", "description", "category"]) {
        const fallback = (live[field] || "") === (entry.source[field] || "") ? entry.proposed.translations[lang]?.[field] : undefined;
        const label = live.translations?.[lang]?.[field] || fallback;
        if (label) translations[lang][field] = label;
      }
    }
    const options = (live.options || []).map(option => {
      const index = entry.source.options.findIndex(source => source.name === option.name && JSON.stringify(source.values) === JSON.stringify(option.values));
      const labels = index >= 0 ? entry.proposed.options[index]?.translations : {};
      return { ...option, translations: Object.fromEntries(["ky", "ru", "en", "tr"].map(lang => [lang, { ...labels?.[lang], ...option.translations?.[lang] }])) };
    });
    const menuOptions = Object.fromEntries(Object.entries(entry.presetOptions || {}).filter(([name, value]) => options.some(option => option.name === name && option.values.includes(value))));
    return [{ ...live, translations, options, menuOptions }];
  });
}
