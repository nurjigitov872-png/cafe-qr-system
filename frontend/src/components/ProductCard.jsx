import React, { useMemo, useState } from "react";

export default function ProductCard({
  product,
  onAdd,
  isFavorite,
  onToggleFavorite,
  t,
}) {
  const [selectedOptions, setSelectedOptions] = useState({});

  const effectivePrice = useMemo(() => {
    return product.discountPrice ?? product.price;
  }, [product.discountPrice, product.price]);

  const handleOptionChange = (name, value) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="product-card">
      {product.popular && <span className="popular-badge">Popular</span>}

      <button
        type="button"
        className={`favorite-btn ${isFavorite ? "active" : ""}`}
        onClick={() => onToggleFavorite(product._id)}
      >
        ♥
      </button>

      <img
        src={product.image || "https://via.placeholder.com/400x250?text=No+Image"}
        alt={product.name}
        className="product-image"
      />

      <div className="product-body">
        <h3>{product.name}</h3>

        <p className="product-desc">
          {product.description || "Даамдуу жана жаңы даярдалган тамак"}
        </p>

        {Array.isArray(product.options) && product.options.length > 0 && (
          <div className="options-list">
            {product.options.map((option) => (
              <div key={option.name} className="option-group">
                <label>{option.name}</label>

                <select
                  value={selectedOptions[option.name] || ""}
                  onChange={(e) =>
                    handleOptionChange(option.name, e.target.value)
                  }
                >
                  <option value="">--</option>
                  {option.values.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="product-footer">
          <div>
            {product.discountPrice ? (
              <>
                <span className="old-price">{product.price} сом</span>
                <span className="price">{effectivePrice} сом</span>
              </>
            ) : (
              <span className="price">{effectivePrice} сом</span>
            )}
          </div>

          <button type="button" onClick={() => onAdd(product, selectedOptions)}>
            {t?.add || "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}