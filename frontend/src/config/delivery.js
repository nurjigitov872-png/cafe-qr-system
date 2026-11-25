export const deliveryEnabled = import.meta.env.VITE_APP_ENV === "staging" && import.meta.env.VITE_DELIVERY_ENABLED === "true";
export const deliveryGpsEnabled = deliveryEnabled && import.meta.env.VITE_DELIVERY_GPS_ENABLED === "true";
