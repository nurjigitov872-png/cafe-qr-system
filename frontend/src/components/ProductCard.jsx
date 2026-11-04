import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { localizedField, optionValueLabel, optionSummary } from "../i18n/customer";
import React, { useState } from "react";
import { CafeIcon } from "./CustomerUI";
import { productPrice } from "../utils/customerData";
export default function ProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  defaultOptions = {},
  preview = false
}) {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  const [selectedOptions, setSelectedOptions] = useState(() => ({
    ...defaultOptions
  }));
  const [imageFailed, setImageFailed] = useState(false);
  const price = productPrice(product);
  return <article className="cafe-product"><div className="cafe-product-media">{product.image && !imageFailed ? <img src={product.image} alt={localizedField(product, "name", language)} loading="lazy" onError={() => setImageFailed(true)} /> : <div className="cafe-image-placeholder"><CafeIcon name="plate" size={52} /><span>{t("Сүрөт азырынча жок")}</span></div>}{product.popular && <span className="cafe-popular">{t("Көп тандалат")}</span>}<button className={"cafe-favorite" + (isFavorite ? " is-favorite" : "")} type="button" aria-label={localizedField(product, "name", language) + (": " + t("сүйүктүүлөр"))} aria-pressed={isFavorite} onClick={() => onToggleFavorite(product._id)}><CafeIcon name="heart" /></button></div><div className="cafe-product-body"><p className="cafe-product-category">{localizedField(product, "category", language)}</p><h3>{localizedField(product, "name", language)}</h3>{(preview || product.menuOptions) && Object.keys(selectedOptions).length > 0 && <p className="cafe-preview-variant">{optionSummary({ productSnapshot: product, selectedOptions }, language)}</p>}{localizedField(product, "description", language) && <p className="cafe-product-description">{localizedField(product, "description", language)}</p>}{(product.options || []).map((option, index) => <label className="cafe-option" key={index}>{localizedField(option, "name", language)}<select value={selectedOptions[option.name] || ""} onChange={event => setSelectedOptions({
          ...selectedOptions,
          [option.name]: event.target.value
        })}><option value="">{t("Тандаңыз")}</option>{(option.values || []).map(value => <option key={value} value={value}>{optionValueLabel(option, value, language)}</option>)}</select></label>)}<div className="cafe-product-bottom"><div>{price !== Number(product.price) && <del>{money(product.price)}</del>}<strong>{money(price)}</strong></div><button className="cafe-add" type="button" onClick={() => onAdd(product, selectedOptions)}><span aria-hidden="true">+</span>{t("Кошуу")}</button></div></div></article>;
}
