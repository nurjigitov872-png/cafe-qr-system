import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { LANGUAGES } from "../i18n/customer";
import React from "react";
import { Link } from "react-router-dom";
import "../customer.css";
export function CafeIcon({
  name,
  size = 20
}) {
  const paths = {
    sun: "M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10",
    bag: "M5 7h14l2 14H3z M9 7V5a3 3 0 0 1 6 0v2",
    search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M4 12h16 m-6-6 6 6-6 6",
    close: "m6 6 12 12 M6 18 18 6",
    cup: "M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M16 9h2a3 3 0 0 1 0 6h-2 M7 3v2 M12 3v2",
    bell: "M4 16h16 M6 16a6 6 0 0 1 12 0 M12 7V5 M8 20h8",
    check: "m5 12 4 4L19 6",
    heart: "M12 21 3 12A5 5 0 0 1 12 5a5 5 0 0 1 9 7z",
    plate: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0"
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.bag} /></svg>;
}
export function CafeBrand() {
  const {
    t
  } = useCustomerPreferences();
  return <span className="cafe-brand"><CafeIcon name="cup" size={25} /><span>café<span>.</span><small>{t("ДААМ ЖАНА ЖЫЛУУЛУК")}</small></span></span>;
}
export function CafeEmpty({
  title,
  detail,
  icon = "bag"
}) {
  return <div className="cafe-empty"><span><CafeIcon name={icon} size={30} /></span><h3>{title}</h3><p>{detail}</p></div>;
}
export function CafeFrame({
  children,
  table = 1,
  menuSuffix = ""
}) {
  const {
    t,
    language,
    theme
  } = useCustomerPreferences();
  return <div className="cafe-customer cafe-result-page" lang={language} data-theme={theme}><header className="cafe-result-header"><Link to={"/table/" + table + menuSuffix} aria-label={t("Менюга кайтуу")}><CafeBrand /></Link><CafePreferences /></header><main className="cafe-result-main">{children}</main><footer className="cafe-footer">{t("Жакшы даам. Жылуу маанай.")}</footer></div>;
}
export const CUSTOMER_STATUSES = {
  pending: "Күтүлүүдө",
  preparing: "Даярдалууда",
  ready: "Даяр",
  served: "Берилди",
  cancelled: "Жокко чыгарылды"
};
export const CUSTOMER_PAYMENTS = {
  cash: "Накталай",
  online: "Онлайн",
  card_online: "Онлайн карта",
  pending: "Төлөнө элек",
  paid: "Төлөндү",
  failed: "Төлөм өтпөдү"
};
export function CafePreferences() {
  const {
    t,
    language,
    theme,
    setLanguage,
    toggleTheme
  } = useCustomerPreferences();
  return <div className="cafe-preferences"><label className="cafe-language"><span className="cafe-screen-reader">{t("Тилди тандоо")}</span><select aria-label={t("Тилди тандоо")} value={language} onChange={event => setLanguage(event.target.value)}>{LANGUAGES.map(item => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label><button className="cafe-icon-button cafe-theme-toggle" type="button" onClick={toggleTheme} aria-label={t(theme === "light" ? "Караңгы темага өтүү" : "Жарык темага өтүү")} title={t(theme === "light" ? "Караңгы темага өтүү" : "Жарык темага өтүү")}><CafeIcon name={theme === "light" ? "moon" : "sun"} /></button></div>;
}
