import { selectCustomerMenu } from "../utils/customerMenu";
import PreviewCheckoutResult from "../components/PreviewCheckoutResult";
import { validatePreviewCheckout } from "../utils/previewCheckout";
import menu15Draft from "../data/menu15-draft.json";
import { buildMenu15Preview, isMenu15Preview } from "../utils/menu15Preview";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import { localizedField } from "../i18n/customer";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import CategoryTabs from "../components/CategoryTabs";
import CartDrawer from "../components/CartDrawer";
import ProductCard from "../components/ProductCard";
import { CafeBrand, CafeEmpty, CafeIcon, CafePreferences } from "../components/CustomerUI";
import { createOrder, createPaymentSession, createWaiterCall, fetchProducts } from "../services/api";
import { productPrice, orderPayload } from "../utils/customerData";
export default function MenuPage() {
  const {
    t,
    language,
    theme,
    money
  } = useCustomerPreferences();
  const {
      tableId
    } = useParams(),
    navigate = useNavigate();
  const [products, setProducts] = useState([]),
    [search, setSearch] = useState(""),
    [activeCategory, setActiveCategory] = useState("");
  const [cartItems, setCartItems] = useState([]),
    [note, setNote] = useState(""),
    [orderType, setOrderType] = useState("takeaway"),
    [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
    [menuLoading, setMenuLoading] = useState(true),
    [menuError, setMenuError] = useState(""),
    [orderError, setOrderError] = useState(""),
    [notice, setNotice] = useState(""),
    [calling, setCalling] = useState(false);
  const preview = isMenu15Preview(useLocation().search, import.meta.env.DEV, window.location.hostname);
  const [mockCheckout, setMockCheckout] = useState(null);
  const submitLock = useRef(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("favorites") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const loadProducts = useCallback(async () => {
    setMenuLoading(true);
    setMenuError("");
    try {
      const data = await fetchProducts();
      if (!Array.isArray(data)) throw new Error("Invalid menu");
      setProducts(preview ? buildMenu15Preview(data, menu15Draft) : selectCustomerMenu(data, menu15Draft));
    } catch {
      setMenuError("Менюну жүктөө мүмкүн болгон жок. Интернет байланышын текшерип, кайра аракет кылыңыз.");
    } finally {
      setMenuLoading(false);
    }
  }, [preview]);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  const categories = useMemo(() => [...new Set(products.map(item => item.category).filter(Boolean))], [products]);
  const filteredProducts = useMemo(() => products.filter(product => (!activeCategory || product.category === activeCategory) && [product.name, localizedField(product, "name", language)].some(name => name?.toLowerCase().includes(search.toLowerCase()))), [products, activeCategory, search, language]);
  const totalAmount = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0), [cartItems]);
  const count = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const add = (product, selectedOptions = {}) => {
    setCartItems(previous => [...previous, {
      _id: product._id + "-" + Date.now() + "-" + Math.random(),
      productId: product._id,
      name: product.name,
      price: productPrice(product),
      qty: 1,
      selectedOptions: {
        ...selectedOptions
      },
      productSnapshot: product
    }]);
    setNotice({
      key: "{name} себетке кошулду",
      product
    });
    setOrderError("");
  };
  const toggleFavorite = id => setFavorites(previous => {
    const next = previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id];
    localStorage.setItem("favorites", JSON.stringify(next));
    return next;
  });
  const callWaiter = async () => {
    if (preview) return;
    setCalling(true);
    try {
      await createWaiterCall(Number(tableId) || 1);
      setNotice("Официант чакырылды. Бир аз күтө туруңуз.");
    } catch {
      setNotice("Официантты чакыруу мүмкүн болгон жок. Кайра аракет кылыңыз.");
    } finally {
      setCalling(false);
    }
  };
  const submit = async () => {
    if (preview) {
      const result = validatePreviewCheckout({ enabled: preview, tableId, items: cartItems, products, totalAmount, orderType, paymentMethod, comment: note });
      if (!result.valid) { setOrderError(result.error); return; }
      setOrderError(""); setCartOpen(false); setMockCheckout(result.checkout);
      return; // Critical: never fall through to createOrder or payment API.
    }
    if (submitLock.current || !cartItems.length) return;
    submitLock.current = true;
    setLoading(true);
    setOrderError("");
    try {
      const response = await createOrder(orderPayload(tableId, cartItems, note, orderType, paymentMethod));
      const order = response?.order || response;
      if (!order?._id) throw new Error("Missing order");
      localStorage.setItem("lastOrderId", order._id);
      localStorage.setItem("lastOrderTable", String(Number(tableId) || 1));
      setCartOpen(false);
      if (paymentMethod === "online") {
        try {
          const payment = await createPaymentSession(order._id);
          if (payment?.paymentUrl) {
            window.location.href = payment.paymentUrl;
            return;
          }
        } catch {/* Order is saved; payment status is shown separately. */}
        navigate("/payment-success?orderId=" + order._id);
        return;
      }
      setCartItems([]);
      setNote("");
      navigate("/success", {
        state: {
          tableId,
          orderId: order._id,
          orderType
        }
      });
    } catch {
      setOrderError("Заказ жөнөтүлгөн жок же жообу алынган жок. Кайра жөнөтүүдөн мурда официанттан тактап алыңыз.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };
  const lastOrder = localStorage.getItem("lastOrderId");
  if (preview && mockCheckout) return <PreviewCheckoutResult checkout={mockCheckout} onBack={() => { setMockCheckout(null); setCartOpen(true); }} />;
  return <div className="cafe-customer" lang={language} data-theme={theme}><header className="cafe-header"><Link to={"/table/" + tableId} aria-label={t("Кафенин менюсу")}><CafeBrand /></Link><CafePreferences /><div className="cafe-header-actions"><span className="cafe-table-badge">{t("Стол №{number}", {
            number: Number(tableId) || 1
          })}</span><button className="cafe-button cafe-button-quiet" aria-label={t("Официант чакыруу")} onClick={callWaiter} disabled={calling || preview}><CafeIcon name="bell" /><span>{calling ? t("Чакырылууда…") : t("Официант")}</span></button>{lastOrder && !preview && <Link className="cafe-icon-button" aria-label={t("Менин заказым")} title={t("Менин заказым")} to={"/my-order/" + lastOrder}><CafeIcon name="bag" /></Link>}</div></header>{preview && <section className="cafe-preview-notice" role="status"><strong>{t("15 товар · Алдын ала көрүнүш")}</strong><p>{t("Котормолор сунуш катары көрсөтүлөт. Бул режимде заказ жөнөтүү жана официант чакыруу жабык. Калган товарлар өчүрүлгөн жок.")}</p></section>}<main className="cafe-menu-layout"><section className="cafe-menu-main"><div className="cafe-welcome"><span className="cafe-eyebrow">{t("КОШ КЕЛИҢИЗ · МЕНЮ")}</span><h1>{t("Жакшы даам.")}<br /><em>{t("Жылуу маанай.")}</em></h1><p>{t("Сүйүктүү даамыңызды тандаңыз.")}<br />{t("Заказды түз эле столуңуздан бериңиз.")}</p><span className="cafe-welcome-line" /></div><div className="cafe-menu-controls"><label className="cafe-search"><CafeIcon name="search" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Бүгүн эмнеден даам татасыз?")} aria-label={t("Менюдан издөө")} /></label><CategoryTabs categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} labelFor={category => localizedField(products.find(product => product.category === category), "category", language) || category} /></div>{notice && <div className="cafe-notice" role="status"><span>{t(notice)}</span><button aria-label={t("Билдирүүнү жабуу")} onClick={() => setNotice("")}><CafeIcon name="close" size={16} /></button></div>}<div className="cafe-section-title"><h2>{activeCategory ? localizedField(products.find(product => product.category === activeCategory), "category", language) || activeCategory : t("Биздин меню")}</h2>{!menuLoading && !menuError && <span>{t("{count} сунуш", {
              count: filteredProducts.length
            })}</span>}</div>{menuLoading ? <div className="cafe-menu-loading" role="status"><span className="cafe-spinner" />{t("Меню даярдалууда…")}</div> : menuError ? <div className="cafe-error-panel" role="alert"><CafeEmpty title={t("Меню ачылган жок")} detail={t(menuError)} icon="cup" /><button className="cafe-button cafe-button-primary" onClick={loadProducts}>{t("Кайра аракет кылуу")}</button></div> : filteredProducts.length ? <div className="cafe-products">{filteredProducts.map(product => <ProductCard key={(preview ? "preview-" : "menu-") + product._id} preview={preview} defaultOptions={product.previewOptions || product.menuOptions} product={product} onAdd={add} isFavorite={favorites.includes(product._id)} onToggleFavorite={toggleFavorite} />)}</div> : <CafeEmpty title={search || activeCategory ? t("Даам табылган жок") : t("Меню азырынча бош")} detail={search || activeCategory ? t("Башка сөз менен издеп же категорияны алмаштырып көрүңүз.") : t("Сураныч, официанттан меню тууралуу тактап алыңыз.")} icon="plate" />}</section><CartDrawer cartItems={cartItems} note={note} setNote={setNote} onIncrease={id => setCartItems(items => items.map(item => item._id === id ? {
        ...item,
        qty: item.qty + 1
      } : item))} onDecrease={id => setCartItems(items => items.map(item => item._id === id ? {
        ...item,
        qty: item.qty - 1
      } : item).filter(item => item.qty > 0))} onRemove={id => setCartItems(items => items.filter(item => item._id !== id))} totalAmount={totalAmount} onSubmit={submit} loading={loading} orderType={orderType} setOrderType={setOrderType} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onClose={closeCart} open={cartOpen} readOnly={false} error={t(orderError)} /></main><footer className="cafe-footer">{t("café. · Жакшы даам менен жагымдуу күн.")}</footer><div className="cafe-mobile-cart"><div><small>{count ? t("{count} товар", {
            count
          }) : t("Сиздин себет")}</small><strong>{money(totalAmount)}</strong></div><button className="cafe-button cafe-button-primary" onClick={() => setCartOpen(true)} aria-expanded={cartOpen} aria-controls="customer-cart"><CafeIcon name="bag" />{t("Себетти ачуу")}{count > 0 && <span>{count}</span>}</button></div></div>;
}
