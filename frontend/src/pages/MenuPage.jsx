import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CategoryTabs from "../components/CategoryTabs";
import CartDrawer from "../components/CartDrawer";
import ProductCard from "../components/ProductCard";
import {
  createOrder,
  createPaymentSession,
  createWaiterCall,
  fetchProducts,
} from "../services/api";

const translations = {
  KG: {
    title: "Менюдан тандап, түз эле заказ бере аласыз",
    search: "Менюдан издөө",
    waiter: "Официант чакыруу",
    myOrder: "Менин заказым",
    waiterSuccess: "Официант чакырылды",
    emptyCart: "Корзина бош",
  },
  RU: {
    title: "Выберите блюда и отправьте заказ",
    search: "Поиск по меню",
    waiter: "Позвать официанта",
    myOrder: "Мой заказ",
    waiterSuccess: "Официант вызван",
    emptyCart: "Корзина пуста",
  },
  EN: {
    title: "Choose dishes and place your order",
    search: "Search menu",
    waiter: "Call waiter",
    myOrder: "My order",
    waiterSuccess: "Waiter called",
    emptyCart: "Cart is empty",
  },
};

export default function MenuPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [lang, setLang] = useState(localStorage.getItem("lang") || "RU");
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [note, setNote] = useState("");

  const [orderType, setOrderType] = useState("takeaway");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [loading, setLoading] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favorites") || "[]");
    } catch {
      return [];
    }
  });

  const t = translations[lang] || translations.RU;

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        alert(error.message || "Продукттарды жүктөөдө ката кетти");
      }
    };

    loadProducts();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(products.map((item) => item.category).filter(Boolean))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const byCategory = activeCategory ? product.category === activeCategory : true;
      const bySearch = product.name
        ?.toLowerCase()
        .includes(search.toLowerCase());

      return byCategory && bySearch;
    });
  }, [products, activeCategory, search]);

  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  }, [cartItems]);

  const handleAddToCart = (product, selectedOptions = {}) => {
    const finalPrice =
      typeof product.discountPrice === "number" && product.discountPrice > 0
        ? product.discountPrice
        : product.price;

    setCartItems((prev) => [
      ...prev,
      {
        _id: `${product._id}-${Date.now()}-${Math.random()}`,
        productId: product._id,
        name: product.name,
        price: Number(finalPrice),
        qty: 1,
        selectedOptions,
      },
    ]);
  };

  const handleIncrease = (id) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, qty: item.qty + 1 } : item
      )
    );
  };

  const handleDecrease = (id) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item._id === id ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const handleRemove = (id) => {
    setCartItems((prev) => prev.filter((item) => item._id !== id));
  };

  const toggleFavorite = (productId) => {
    const nextFavorites = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];

    setFavorites(nextFavorites);
    localStorage.setItem("favorites", JSON.stringify(nextFavorites));
  };

  const handleWaiterCall = async () => {
    try {
      await createWaiterCall(Number(tableId));
      alert(t.waiterSuccess);
    } catch (error) {
      alert(error.message || "Официант чакырууда ката кетти");
    }
  };

  const handleSubmitOrder = async () => {
    if (!cartItems.length) {
      alert(t.emptyCart);
      return;
    }

    const payload = {
      tableNumber: Number(tableId) || 1,
      items: cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: Number(item.price),
        qty: Number(item.qty),
      })),
      totalAmount: Number(totalAmount),
      comment: note || "",
      orderType: orderType === "dinein" ? "dinein" : "takeaway",
      paymentMethod: paymentMethod === "online" ? "online" : "cash",
    };

    try {
      setLoading(true);

      const response = await createOrder(payload);
      const createdOrder = response?.order || response;

      if (!createdOrder?._id) {
        throw new Error("Заказ түзүлгөн жок");
      }

      localStorage.setItem("lastOrderId", createdOrder._id);

      if (paymentMethod === "online") {
        try {
          const paymentResponse = await createPaymentSession(createdOrder._id);

          if (paymentResponse?.paymentUrl) {
            window.location.href = paymentResponse.paymentUrl;
            return;
          }
        } catch {
          console.log("Payment session жок, success бетке өтөт");
        }

        navigate(`/payment-success?orderId=${createdOrder._id}`);
        return;
      }

      setCartItems([]);
      setNote("");

      navigate("/success", {
        state: {
          tableId,
          orderId: createdOrder._id,
        },
      });
    } catch (error) {
      alert(error.message || "Заказ жөнөтүүдө ката кетти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <span className="tag">QR MENU</span>
          <h1>Стол №{tableId}</h1>
          <p className="subtitle">{t.title}</p>

          <div className="hero-actions">
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="KG">KG</option>
              <option value="RU">RU</option>
              <option value="EN">EN</option>
            </select>

            <button className="secondary-btn" onClick={handleWaiterCall}>
              {t.waiter}
            </button>

            <Link
              className="secondary-btn"
              to={`/my-order/${localStorage.getItem("lastOrderId") || ""}`}
            >
              {t.myOrder}
            </Link>
          </div>
        </div>
      </header>

      <div className="content-grid">
        <main className="menu-section">
          <div className="search-wrap">
            <input
              type="text"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />

          <div className="products-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAdd={handleAddToCart}
                  isFavorite={favorites.includes(product._id)}
                  onToggleFavorite={toggleFavorite}
                  t={t}
                />
              ))
            ) : (
              <div className="empty-state">Продукт табылган жок</div>
            )}
          </div>
        </main>

        <aside className="cart-aside">
          <CartDrawer
            cartItems={cartItems}
            note={note}
            setNote={setNote}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onRemove={handleRemove}
            totalAmount={totalAmount}
            onSubmit={handleSubmitOrder}
            loading={loading}
            orderType={orderType}
            setOrderType={setOrderType}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            t={t}
          />
        </aside>
      </div>
    </div>
  );
}