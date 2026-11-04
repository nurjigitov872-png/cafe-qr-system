import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {notificationWords,notificationText,mergeNotifications} from "../src/notifications/messages.js";
const source=fs.readFileSync(new URL("../src/notifications/client.js",import.meta.url),"utf8").replaceAll("import.meta.env.VITE_API_URL",JSON.stringify("https://fake.invalid/api")).replaceAll("import.meta.env.VITE_SOCKET_URL",JSON.stringify("https://fake.invalid"));
const {enablePush,supportsPush,pushDiagnostics,sendTestPush}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
test("all notification labels and statuses cover ky/ru/en/tr",()=>{const keys=Object.keys(notificationWords("ky"));for(const lang of ["ky","ru","en","tr"]){assert.deepEqual(Object.keys(notificationWords(lang)),keys);for(const status of ["pending","preparing","ready","served","cancelled"])assert.ok(notificationText({kind:"order.status",status},lang));}assert.equal(notificationText({kind:"order.status",status:"ready"},"en"),"Your order is ready");assert.equal(notificationWords("ky").bell,"Билдирүүлөр");assert.equal(notificationWords("ru").bell,"Уведомления");assert.equal(notificationWords("tr").bell,"Bildirimler");});
test("duplicates/reconnect/reload merge by stable key and retain read state",()=>{const event={key:"same",createdAt:"2026-11-05",read:false};const one=mergeNotifications([],[event,event]);assert.equal(one.length,1);assert.equal(mergeNotifications([{...event,read:true}],[event])[0].read,true);assert.equal(mergeNotifications([],Array.from({length:120},(_,i)=>({...event,key:String(i)}))).length,100);});
test("unsupported browser and missing VAPID never prompt or subscribe",async()=>{let prompts=0;const scope={isSecureContext:true,Notification:{requestPermission:()=>prompts++},navigator:{serviceWorker:{}},PushManager:{}};assert.equal(await enablePush({scope,config:{enabled:false}}),"unconfigured");assert.equal(await enablePush({scope:{}}),"unsupported");assert.equal(supportsPush({...scope,isSecureContext:false}),false);assert.equal(prompts,0);});
test("denied permission never registers a subscription or backend write",async()=>{let writes=0;const scope={isSecureContext:true,PushManager:{},navigator:{serviceWorker:{}},Notification:{requestPermission:async()=>"denied"}};assert.equal(await enablePush({scope,config:{enabled:true,publicKey:"AAAA"},request:()=>writes++}),"denied");assert.equal(writes,0);});
test("explicit permission gesture registers mock subscription scoped by bearer token and language",async()=>{const calls=[];let prompted=false;const subscription={toJSON:()=>({endpoint:"fake-push",keys:{}})};const scope={isSecureContext:true,PushManager:{},Notification:{requestPermission:()=>{prompted=true;return Promise.resolve("granted");}},navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe:async options=>{assert.equal(options.userVisibleOnly,true);return subscription;}}})}}};const resultPromise=enablePush({token:"fake-order-token",language:"tr",config:{enabled:true,publicKey:"AAAA"},scope,request:async(...args)=>calls.push(args)});assert.equal(prompted,true);assert.equal(await resultPromise,"enabled");assert.equal(calls[0][0],"fake-order-token");assert.equal(calls[0][2].body.language,"tr");});
test("service worker only opens same-origin permitted routes and notification tag deduplicates",async()=>{const handlers={},opened=[];const self={location:{origin:"https://fake.invalid"},addEventListener:(name,handler)=>handlers[name]=handler,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};vm.runInNewContext(fs.readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),{self,URL,Promise,Date});for(const path of ["https://evil.invalid/","//evil.invalid/","/admin/products","/my-order/000000000000000000000001"]){let pending;handlers.notificationclick({notification:{data:{url:path},close:()=>{}},waitUntil:p=>pending=p});await pending;}assert.deepEqual(opened,["https://fake.invalid/","https://fake.invalid/","https://fake.invalid/","https://fake.invalid/my-order/000000000000000000000001"]);});

test("development diagnostics expose only safe capability/permission/state flags",async()=>{
 const registration={active:{state:"activated"},pushManager:{getSubscription:async()=>({endpoint:"PRIVATE-ENDPOINT",keys:{auth:"PRIVATE-KEY"}})}};
 const scope={isSecureContext:true,Notification:{permission:"granted"},PushManager:{},navigator:{serviceWorker:{controller:{},getRegistration:async()=>registration}}};
 const info=await pushDiagnostics(scope);
 assert.equal(info.secureContext,true);assert.equal(info.subscription,true);assert.equal(info.serviceWorker,"activated");assert.ok(!JSON.stringify(info).includes("PRIVATE"));
});
test("test push only uses current browser subscription, never asks permission, and stays on fake API",async()=>{
 const oldFetch=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({code:"pushScheduled"})};};
 try{
  const registration={pushManager:{getSubscription:async()=>({endpoint:"fake-own-endpoint"})}};
  const scope={navigator:{serviceWorker:{getRegistration:async()=>registration}}};
  assert.equal((await sendTestPush("fake-jwt",15,scope)).code,"pushScheduled");
  assert.equal(calls[0].url,"https://fake.invalid/api/notifications/test-push");
  assert.deepEqual(JSON.parse(calls[0].options.body),{endpoint:"fake-own-endpoint",delaySeconds:15});
  assert.equal(calls[0].options.headers.Authorization,"Bearer fake-jwt");
  await assert.rejects(sendTestPush("fake-jwt",15,{navigator:{serviceWorker:{getRegistration:async()=>null}}}),{code:"subscriptionMissing"});
 }finally{globalThis.fetch=oldFetch;}
});

test("mock worker records safe push diagnostics and still displays when IndexedDB fails",async()=>{
 const handlers={},storage=new Map(),shown=[];
 const cache={put:async(key,response)=>storage.set(key,response),match:async key=>storage.get(key)?.clone()};
 const self={addEventListener:(name,handler)=>handlers[name]=handler,clients:{matchAll:async()=>[]},registration:{showNotification:async(...args)=>shown.push(args)}};
 vm.runInNewContext(fs.readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),{self,Date,Promise,Response,caches:{open:async()=>cache},indexedDB:{open:()=>{throw Error("mock unavailable");}}});
 let pending;handlers.push({data:{json:()=>({id:"mock-test-only",body:"Safe test",url:"/"})},waitUntil:value=>pending=value});await pending;
 assert.equal(shown.length,1);assert.equal(shown[0][1].tag,"mock-test-only");const diagnostic=await storage.get("/__push_status__").clone().json();assert.equal(diagnostic.state,"shown");assert.ok(!JSON.stringify(diagnostic).includes("Safe test"));
 let response;handlers.message({data:{type:"push-diagnostics"},ports:[{postMessage:value=>response=value}],waitUntil:value=>pending=value});await pending;assert.equal(response.lastPush.state,"shown");
});
