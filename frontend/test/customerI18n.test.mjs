import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { dictionaries, LANGUAGES, translate, localizedField, optionValueLabel, optionSummary } from "../src/i18n/customer.js";
import { orderPayload } from "../src/utils/customerData.js";
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
test("all four dictionaries contain every UI key and matching placeholders", () => {
  const keys = Object.keys(dictionaries.ky).sort();
  assert.deepEqual(LANGUAGES.map(item => item.code), ["ky","ru","en","tr"]);
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(dictionaries[language.code]).sort(), keys);
    for (const key of keys) {
      const value = dictionaries[language.code][key]; assert.equal(typeof value, "string"); assert.ok(value.trim());
      assert.deepEqual((value.match(/\{\w+\}/g) || []).sort(), (key.match(/\{\w+\}/g) || []).sort());
      if (["en","tr"].includes(language.code)) assert.ok(!/[\u0400-\u04ff]/u.test(value), key);
    }
  }
});
test("interpolation and unsupported locale fallback remain safe plain text", () => {
  assert.equal(translate("en", "Стол №{number}", { number: 12 }), "Table 12");
  assert.equal(translate("tr", "{count} товар", { count: 2 }), "2 ürün");
  assert.equal(translate("bad", "Кошуу"), "Кошуу");
  assert.equal(translate("en", "{name} себетке кошулду", { name: "<b>Товар</b>" }), "<b>Товар</b> added to your basket");
});
test("API translations are used only when supplied, otherwise original data is retained", () => {
  const product = { name: "Кофе", category: "Суусундук", translations: { en: { name: "Coffee", category: "Drinks" } } };
  assert.equal(localizedField(product,"name","en"), "Coffee");
  assert.equal(localizedField(product,"category","en"), "Drinks");
  assert.equal(localizedField(product,"name","tr"), "Кофе");
  assert.equal(localizedField({ name: "Кофе", nameTranslations: { tr: "Kahve" } },"name","tr"), "Kahve");
  assert.equal(localizedField(product,"description","en"), "");
});
test("localized option labels never replace original backend option keys, values or product name", () => {
  const option = { name: "Сүт", values: ["Сулу"], translations: { en: { name: "Milk", values: { Сулу: "Oat" } } } };
  const item = { productId: "original-id", name: "Кофе", qty: 2, price: 150, selectedOptions: { Сүт: "Сулу" }, productSnapshot: { options: [option] } };
  assert.equal(optionValueLabel(option,"Сулу","en"), "Oat");
  assert.equal(optionSummary(item,"en"), "Milk: Oat");
  const payload = orderPayload(12,[item],"Original note","takeaway","online");
  assert.deepEqual(payload.items[0].selectedOptions,{ Сүт: "Сулу" }); assert.equal(payload.items[0].name,"Кофе");
  assert.equal(payload.items[0].price,150); assert.equal(payload.tableNumber,12); assert.equal(payload.orderType,"takeaway");
  assert.ok(!("productSnapshot" in payload.items[0])); assert.ok(!("language" in payload));
});
function preferences(initial = {}, dark = false) {
  const storage = new Map(Object.entries(initial)), events = {}, mediaListeners = [];
  const module = { exports: {} };
  const source = fs.readFileSync(new URL("../src/i18n/useCustomerPreferences.js", import.meta.url), "utf8");
  const code = esbuild.transformSync(source,{format:"cjs"}).code;
  vm.runInNewContext(code,{module,exports:module.exports,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},window:{matchMedia:()=>({matches:dark,addEventListener:(name,callback)=>mediaListeners.push(callback)}),addEventListener:(name,callback)=>{events[name]=callback;}},require:name=>name==="react"?{useSyncExternalStore:(_,get)=>get()}:{LANGUAGES,translate,localizedField}});
  return { get:()=>module.exports.default(), storage, events, mediaListeners };
}
test("preferences default to Kyrgyz/system theme, while saved user choices win", () => {
  assert.equal(preferences().get().language,"ky"); assert.equal(preferences().get().theme,"light");
  assert.equal(preferences({},true).get().theme,"dark");
  const stored=preferences({cafe_language:"tr",cafe_theme:"light"},true);
  assert.equal(stored.get().language,"tr"); assert.equal(stored.get().theme,"light");
});
test("language/theme persist without navigation and invalid language is ignored", () => {
  const store=preferences(); store.get().setLanguage("en"); store.get().toggleTheme();
  assert.equal(store.get().language,"en"); assert.equal(store.get().theme,"dark");
  assert.equal(store.storage.get("cafe_language"),"en"); assert.equal(store.storage.get("cafe_theme"),"dark");
  store.get().setLanguage("bad"); assert.equal(store.get().language,"en");
  const reopened=preferences(Object.fromEntries(store.storage)); assert.equal(reopened.get().language,"en"); assert.equal(reopened.get().theme,"dark");
});
test("saved preferences synchronize across tabs", () => {
  const store=preferences(); store.storage.set("cafe_language","ru"); store.storage.set("cafe_theme","dark");
  store.events.storage({key:"cafe_language"}); assert.equal(store.get().language,"ru"); assert.equal(store.get().theme,"dark");
});
function luminance(hex) { const value=hex.slice(1);const expanded=value.length===3?value.split("").map(c=>c+c).join(""):value;const channels=[0,2,4].map(i=>parseInt(expanded.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722; }
test("main text, secondary text and buttons meet 4.5:1 contrast in both themes", () => {
  const css=fs.readFileSync(new URL("../src/customer.css",import.meta.url),"utf8");
  for(const selector of [".cafe-customer {",'.cafe-customer[data-theme="dark"] {']){
    const start=css.indexOf(selector);const block=css.slice(start,css.indexOf("}",start));const colors=Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]+)/gi)].map(m=>[m[1],m[2]]));
    for(const [foreground,background]of [["--cafe-text","--cafe-bg"],["--cafe-text","--cafe-panel"],["--cafe-muted","--cafe-bg"],["--cafe-muted","--cafe-panel"],["--cafe-on-accent","--cafe-green"],["--cafe-pending","--cafe-pending-bg"],["--cafe-error","--cafe-error-bg"],["--cafe-blue","--cafe-blue-bg"]]){
      const a=luminance(colors[foreground]),b=luminance(colors[background]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,selector+foreground+background);
    }
  }
});
