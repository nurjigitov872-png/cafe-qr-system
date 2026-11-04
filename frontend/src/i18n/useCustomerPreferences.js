import { useSyncExternalStore } from "react";
import { LANGUAGES, translate, localizedField } from "./customer";
const languageKey = "cafe_language", themeKey = "cafe_theme";
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const validLanguage = value => LANGUAGES.some(language => language.code === value);
const systemTheme = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
let snapshot = { language: validLanguage(read(languageKey)) ? read(languageKey) : "ky", theme: ["light", "dark"].includes(read(themeKey)) ? read(themeKey) : systemTheme() };
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const persist = (key,value) => { try { localStorage.setItem(key,value); } catch { /* Session choice still works with blocked storage. */ } };
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!read(themeKey)) { snapshot = { ...snapshot, theme: systemTheme() }; emit(); }
  });
  window.addEventListener("storage", event => {
    if (![languageKey,themeKey,null].includes(event.key)) return;
    snapshot = { language: validLanguage(read(languageKey)) ? read(languageKey) : "ky", theme: ["light","dark"].includes(read(themeKey)) ? read(themeKey) : systemTheme() }; emit();
  });
}
export default function useCustomerPreferences() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { ...state,
    setLanguage: language => { if (!validLanguage(language)) return; snapshot = { ...snapshot, language }; persist(languageKey,language); emit(); },
    toggleTheme: () => { const theme = snapshot.theme === "light" ? "dark" : "light"; snapshot = { ...snapshot, theme }; persist(themeKey,theme); emit(); },
    t: (key,params) => key && typeof key === "object" ? translate(state.language,key.key,key.product ? { name: localizedField(key.product,"name",state.language) } : key.params) : translate(state.language,key,params),
    money: value => new Intl.NumberFormat(state.language === "ky" ? "ky-KG" : state.language, { maximumFractionDigits: 2 }).format(Number(value) || 0) + (state.language === "en" ? " KGS" : state.language === "tr" ? " som" : " сом"),
  };
}
