import useCustomerPreferences from "../i18n/useCustomerPreferences";
import React from "react";
export default function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
  labelFor = category => category
}) {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  return <nav className="cafe-categories" aria-label={t("Меню категориялары")}>{[["", t("Баары")], ...categories.map(category => [category, category])].map(([value, label]) => <button type="button" key={value} aria-pressed={activeCategory === value} onClick={() => onSelect(value)}>{value ? labelFor(value) : label}</button>)}</nav>;
}
