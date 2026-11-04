const CACHE="cafe-notifications-v1";
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/offline.html","/icons/cafe-192.png","/icons/cafe-512.png"])));});
self.addEventListener("activate",event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("cafe-notifications-")&&key!==CACHE).map(key=>caches.delete(key))))])));
// Never cache API responses, order pages, tokens or authenticated HTML.
self.addEventListener("fetch",event=>{if(event.request.mode==="navigate"&&new URL(event.request.url).origin===self.location.origin)event.respondWith(fetch(event.request).catch(()=>caches.match("/offline.html")));});
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open("cafe-notification-dedup",1);request.onupgradeneeded=()=>request.result.createObjectStore("seen",{keyPath:"id"});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function firstDelivery(id){const db=await database();return new Promise((resolve,reject)=>{const transaction=db.transaction("seen","readwrite"),store=transaction.objectStore("seen");let fresh=false;const read=store.get(id);read.onsuccess=()=>{if(!read.result){fresh=true;store.put({id,time:Date.now()});}const cursor=store.openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(row){if(row.value.time<Date.now()-7*86400000)row.delete();row.continue();}};};transaction.oncomplete=()=>{db.close();resolve(fresh);};transaction.onerror=()=>{db.close();reject(transaction.error);};});}
async function pushState(state){try{const cache=await caches.open(CACHE);await cache.put("/__push_status__",new Response(JSON.stringify({state,at:new Date().toISOString()}),{headers:{"Content-Type":"application/json"}}));}catch{}}
self.addEventListener("message",event=>{if(event.data?.type!=="push-diagnostics"||!event.ports?.[0])return;event.waitUntil((async()=>{let lastPush=null;try{const cached=await (await caches.open(CACHE)).match("/__push_status__");if(cached)lastPush=await cached.json();}catch{}event.ports[0].postMessage({version:CACHE,lastPush});})());});
self.addEventListener("push",event=>event.waitUntil((async()=>{
 await pushState("received");
 let data;try{data=event.data.json();}catch{await pushState("invalid-payload");return;}
 if(typeof data.id!=="string"||typeof data.body!=="string"){await pushState("invalid-payload");return;}
 try{if(!await firstDelivery(data.id)){await pushState("duplicate");return;}}catch{/* IndexedDB failure must not silently discard a push. Notification tag still deduplicates. */}
 const tabs=await self.clients.matchAll({type:"window",includeUncontrolled:true});tabs.forEach(tab=>tab.postMessage({type:"notification",id:data.id}));
 try{await self.registration.showNotification("Café QR",{body:data.body.slice(0,200),tag:data.id,renotify:false,icon:"/icons/cafe-192.png",data:{url:data.url}});await pushState("shown");}catch{await pushState("notification-failed");}
})()));
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const path=event.notification.data?.url;const safe=typeof path==="string"&&(/^\/my-order\/[a-f0-9]{24}$/i.test(path)||["/admin/kitchen","/admin/waiter"].includes(path))?path:"/";const url=new URL(safe,self.location.origin).href;const tabs=await self.clients.matchAll({type:"window",includeUncontrolled:true});const tab=tabs.find(t=>t.url===url);if(tab)return tab.focus();return self.clients.openWindow(url);})());});
