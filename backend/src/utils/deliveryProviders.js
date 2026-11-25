function distanceKm(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const delta = Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, delta)));
}

const estimate = (from, to, speedKmh) => {
  const distance = distanceKm(from, to);
  return { distanceKm: Math.round(distance * 100) / 100, deliveryMinutes: Math.max(1, Math.ceil(distance / speedKmh * 60)) };
};

const deliveryProviders = Object.freeze({
  internal: { estimate, dispatch: "internal" },
  yandex: { estimate, dispatch: "demo", label: "Yandex Delivery" },
  glovo: { estimate, dispatch: "demo", label: "Glovo On-Demand" },
});

module.exports = { deliveryProviders, distanceKm };
