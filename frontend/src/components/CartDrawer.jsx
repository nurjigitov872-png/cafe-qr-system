import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { localizedField, optionSummary } from "../i18n/customer";
import React, { useEffect, useRef, useState } from "react";
import { CafeEmpty, CafeIcon } from "./CustomerUI";
import PickupFields from "./PickupFields";
import "../utils/customerData";
export default function CartDrawer({
  cartItems,
  note,
  setNote,
  onIncrease,
  onDecrease,
  onRemove,
  totalAmount,
  onSubmit,
  loading,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  onClose,
  open,
  error,
  pickup,
  onPickupChange,
  deliveryFields,
  readOnly = false
}) {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  const panel = useRef(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 1000px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1000px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current.querySelector("button")?.focus();
    const keydown = event => {
      if (event.key === "Escape" && !loading) onClose();
      if (event.key === "Tab") {
        const items = [...panel.current.querySelectorAll("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)")];
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open, mobile, loading, onClose]);
  return <>{open && mobile && <button className="cafe-cart-backdrop" aria-label={t("Себетти жабуу")} onClick={onClose} disabled={loading} tabIndex={-1} />}<aside id="customer-cart" ref={panel} className={"cafe-cart" + (open ? " is-open" : "")} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} aria-labelledby="cart-heading" inert={mobile && !open ? "" : undefined}><div className="cafe-cart-heading"><div><span className="cafe-eyebrow">{t("СИЗ ТАНДАГАН ДААМДАР")}</span><h2 id="cart-heading">{t("Сиздин себет")}</h2></div><button className="cafe-cart-close cafe-icon-button" aria-label={t("Себетти жабуу")} onClick={onClose} disabled={loading}><CafeIcon name="close" /></button></div>{!cartItems.length ? <CafeEmpty title={t("Себетиңиз азырынча бош")} detail={t("Менюдан жаккан даамды тандап, «Кошуу» баскычын басыңыз.")} /> : <><div className="cafe-cart-items">{cartItems.map(item => <article className="cafe-cart-item" key={item._id}><div className="cafe-cart-item-top"><h3>{localizedField(item.productSnapshot || item, "name", language)}</h3><button className="cafe-remove" aria-label={localizedField(item.productSnapshot || item, "name", language) + (": " + t("себеттен алып салуу"))} onClick={() => onRemove(item._id)} disabled={loading}><CafeIcon name="close" size={16} /></button></div>{Object.keys(item.selectedOptions || {}).length > 0 && <p className="cafe-item-options">{optionSummary(item, language)}</p>}<div className="cafe-cart-item-bottom"><div className="cafe-quantity"><button aria-label={localizedField(item.productSnapshot || item, "name", language) + (": " + t("санын азайтуу"))} onClick={() => onDecrease(item._id)} disabled={loading}>−</button><span aria-live="polite">{item.qty}</span><button aria-label={localizedField(item.productSnapshot || item, "name", language) + (": " + t("санын көбөйтүү"))} onClick={() => onIncrease(item._id)} disabled={loading}>+</button></div><strong>{money(item.price * item.qty)}</strong></div></article>)}</div><fieldset className="cafe-cart-fields" disabled={loading}><legend>{t("Заказ маалыматы")}</legend>{deliveryFields || (pickup ? <PickupFields value={pickup} onChange={onPickupChange} /> : <><div className="cafe-choice-group"><span>{t("Заказдын түрү")}</span><div>{[["dinein", t("Залда")], ["takeaway", t("Алып кетүү")]].map(([value, label]) => <label key={value}><input type="radio" name="orderType" checked={orderType === value} onChange={() => setOrderType(value)} />{label}</label>)}</div></div><div className="cafe-choice-group"><span>{t("Төлөм ыкмасы")}</span><div>{[["cash", t("Накталай")], ["online", t("Онлайн")]].map(([value, label]) => <label key={value}><input type="radio" name="paymentMethod" checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} />{label}</label>)}</div></div></>)}{!deliveryFields && <label className="cafe-option">{t("Комментарий")}<textarea value={note} onChange={event => setNote(event.target.value)} placeholder={t("Каалооңуз же өзгөчө өтүнүчүңүз…")} /></label>}</fieldset>{error && <div className="cafe-alert" role="alert">{t(error)}</div>}<div className="cafe-cart-total"><span>{t("Жалпы сумма")}</span><strong>{money(totalAmount)}</strong></div><button className="cafe-button cafe-button-primary cafe-submit" onClick={onSubmit} disabled={loading || readOnly}>{loading ? t("Заказ жөнөтүлүүдө…") : t("Заказды ырастоо")}<CafeIcon name="arrow" size={18} /></button>{!pickup && !deliveryFields && <p className="cafe-cart-footnote">{t("Жөнөтүүдөн мурда товарларды жана стол номерин текшериңиз.")}</p>}</>}</aside></>;
}
