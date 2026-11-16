import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { selectCustomerMenu } from "../src/utils/customerMenu.js";
import { orderPayload } from "../src/utils/customerData.js";
import { localizedField } from "../src/i18n/customer.js";
const manifest = JSON.parse(fs.readFileSync(new URL("../src/data/menu15-draft.json", import.meta.url)));
const live = () => manifest.products.map(e => ({ ...structuredClone(e.source), _id:e.productId, options:e.source.options.map((o,i) => ({...structuredClone(o), _id:"live-"+i})) }));
test("normal customer menu selects 15 IDs; other catalog records remain untouched", () => {
 const data=[...live(),{_id:"other",name:"Other"}], before=JSON.stringify(data);
 const result=selectCustomerMenu(data,manifest);
 assert.equal(result.length,15); assert.equal(JSON.stringify(data),before);
 assert.deepEqual(result.map(p=>p._id),manifest.products.map(e=>e.productId));
 for(const group of ["Food","Drink","Dessert"]) assert.equal(result.filter(p=>p.category===group).length,5);
});
test("current API prices, images, IDs and raw options win; four display languages preserve payload", () => {
 const data=live();data[0].price=777;data[0].image="current.jpg";
 const menu=selectCustomerMenu(data,manifest);assert.equal(menu[0].price,777);assert.equal(menu[0].image,"current.jpg");
 for(const lang of ["ky","ru","en","tr"]) for(const [i,p] of menu.entries()) assert.equal(localizedField(p,"name",lang),manifest.products[i].proposed.translations[lang].name);
 const p=menu.at(-1);const payload=orderPayload("12",[{productId:p._id,name:p.name,price:p.price,qty:2,selectedOptions:p.menuOptions,productSnapshot:p}],"test","dinein","cash");
 assert.equal(payload.tableNumber,12);assert.equal(payload.totalAmount,p.price*2);assert.deepEqual(payload.items[0].selectedOptions,manifest.products.at(-1).presetOptions);assert.ok(!("productSnapshot" in payload.items[0]));assert.deepEqual(p.options.map(o=>o._id),data.at(-1).options.map(o=>o._id));
});
test("missing, hidden or unavailable selections are never replaced by unselected items",()=>{
 const data=live();data[0].hidden=true;data[1].available=false;data.pop();data.push({_id:"unselected"});assert.equal(selectCustomerMenu(data,manifest).length,12);
 const broken=structuredClone(manifest);broken.products[0].productId=broken.products[1].productId;assert.throws(()=>selectCustomerMenu(data,broken));
});
test("API translations take precedence; changed source text does not receive stale translations",()=>{
 const data=live();data[0].name="Changed";data[1].translations={en:{name:"Approved API label"}};
 const menu=selectCustomerMenu(data,manifest);assert.equal(localizedField(menu[0],"name","en"),"Changed");assert.equal(localizedField(menu[1],"name","en"),"Approved API label");
});
test("existing API order and waiter integrations work against fake fetch only",async()=>{
 const source=fs.readFileSync(new URL("../src/services/api.js",import.meta.url),"utf8").replace('import { API as API_URL } from "../config/connections.js";', 'const API_URL="https://fake.invalid/api";').replace("../notifications/events.js",new URL("../src/notifications/events.js",import.meta.url).href);
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;const calls=[],storage=new Map();
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 globalThis.fetch=async(url,init)=>{calls.push({url,...init,body:JSON.parse(init.body)});return {ok:true,json:async()=>url.endsWith("/orders")?{order:{_id:"fake-order"},orderToken:"fake-owner-token"}:{success:true}};};
 try {const api=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));const p=selectCustomerMenu(live(),manifest).at(-1);const payload=orderPayload(12,[{productId:p._id,name:p.name,price:p.price,qty:2,selectedOptions:p.menuOptions}],"test","dinein","cash");await api.createOrder(payload);await api.createWaiterCall(12);assert.deepEqual(calls.map(c=>c.url),["https://fake.invalid/api/orders","https://fake.invalid/api/waiter-calls"]);assert.deepEqual(calls[0].body,payload);assert.ok(calls.every(call=>call.redirect==="error"));assert.deepEqual(calls[1].body,{tableNumber:12});assert.equal(storage.get("order_token_fake-order"),"fake-owner-token");}
 finally {globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
