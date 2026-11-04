import useCustomerPreferences from "../i18n/useCustomerPreferences";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CafeFrame, CafeIcon } from "../components/CustomerUI";
export default function SuccessPage() {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  const {
    state
  } = useLocation();
  const table = state?.tableId || localStorage.getItem("lastOrderTable") || 1;
  const id = state?.orderId || localStorage.getItem("lastOrderId");
  return <CafeFrame table={table}><section className="cafe-result-card"><span className="cafe-result-symbol"><CafeIcon name="check" size={35} /></span><span className="cafe-eyebrow">{t("РАХМАТ!")}</span><h1>{id ? t("Заказыңыз кабыл алынды") : t("Заказыңызды текшериңиз")}</h1><p>{id ? t("Заказдын жүрүшүн төмөнкү баскычтан көзөмөлдөй аласыз.") : t("Менюдан даам тандап, биринчи заказыңызды бериңиз.")}</p>{id && <div className="cafe-confirmation-details"><div><span>{t("Заказ")}</span><strong>№{String(id).slice(-6).toUpperCase()}</strong></div><div><span>{t("Стол")}</span><strong>№{table}</strong></div>{state?.orderType && <div><span>{t("Заказдын түрү")}</span><strong>{state.orderType === "dinein" ? t("Залда") : t("Алып кетүү")}</strong></div>}</div>}<div className="cafe-result-actions">{id && <Link className="cafe-button cafe-button-primary" to={"/my-order/" + id}>{t("Заказды көзөмөлдөө")}<CafeIcon name="arrow" /></Link>}<Link className="cafe-button cafe-button-outline" to={"/table/" + table}>{t("Менюга кайтуу")}</Link></div></section></CafeFrame>;
}
