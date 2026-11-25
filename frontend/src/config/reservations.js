export const reservationsEnabled = import.meta.env.VITE_APP_ENV === "staging" &&
  import.meta.env.VITE_RESERVATIONS_ENABLED === "true";
