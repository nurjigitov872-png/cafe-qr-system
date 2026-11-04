import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {orderStatusEvent,emitOrderStatus} from "../src/notifications/events.js";
const require=createRequire(import.meta.url),{eventFor}=require("../../backend/src/utils/notificationPolicy.js");
const order={_id:"000000000000000000000001",tableNumber:12,updatedAt:"2026-01-01T01:00:00Z",status:"ready"};
test("local status key exactly matches backend Socket.IO key for all statuses",()=>{for(const status of ["pending","preparing","ready","served","cancelled"]){const record={...order,status};assert.equal(orderStatusEvent(record).key,eventFor("order.status",record).key);const legacy={...record};delete legacy.updatedAt;assert.equal(orderStatusEvent(legacy).key,eventFor("order.status",legacy).key);}assert.equal(orderStatusEvent({...order,updatedAt:"invalid"}),null);assert.equal(orderStatusEvent({...order,status:"invalid"}),null);});
test("successful local status/cancel API responses emit notification, rejected requests never emit",async()=>{
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window,oldStorage=globalThis.localStorage;const events=[];globalThis.window={dispatchEvent:event=>events.push(event)};globalThis.localStorage={getItem:()=>"fake-token"};
 const source=fs.readFileSync(new URL("../src/services/api.js",import.meta.url),"utf8").replace("import.meta.env.VITE_API_URL",JSON.stringify("https://fake.invalid/api")).replace("../notifications/events.js",new URL("../src/notifications/events.js",import.meta.url).href);
 try{const api=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));globalThis.fetch=async()=>({ok:true,json:async()=>order});await api.updateOrderStatus(order._id,"ready");await api.cancelOrder(order._id);assert.equal(events.length,2);assert.equal(events[0].type,"cafe:notification");assert.equal(events[0].detail.key,eventFor("order.status",order).key);globalThis.fetch=async()=>({ok:false,json:async()=>({message:"mock rejection"})});await assert.rejects(api.updateOrderStatus(order._id,"served"));assert.equal(events.length,2);const invalid={};assert.equal(emitOrderStatus(invalid),invalid);assert.equal(events.length,2);}
 finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow;globalThis.localStorage=oldStorage;}
});
