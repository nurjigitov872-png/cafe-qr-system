const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const express=require("express");
process.env.JWT_SECRET="test-only-notification-secret-"+"x".repeat(32);process.env.ADMIN_USERNAME="test-admin";
const {signToken}=require("../src/middleware/auth");
const {identity,socketAuth,connectSocket,eventFor,validateSubscription}=require("../src/utils/notificationPolicy");
const {createNotifications}=require("../src/utils/notifications");
const id="000000000000000000000001",other="000000000000000000000002";
const customer=()=>signToken({role:"customer"},id),admin=()=>signToken({role:"admin"},"test-admin");
const record={_id:id,status:"ready",tableNumber:12,updatedAt:new Date("2026-11-01T00:00:00Z")};
test("socket rejects missing, invalid, expired and foreign admin JWTs",()=>{
 for(const token of [undefined,"invalid",signToken({role:"guest"},"x"),signToken({role:"admin"},"other")]){let error;socketAuth({handshake:{auth:{token}},data:{}},value=>error=value);assert.ok(error);}
});
test("customer socket joins only its token order; client-selected room cannot override it",()=>{
 const socket={handshake:{auth:{token:customer(),orderId:other,role:"admin"}},data:{},join:room=>rooms.push(room),on:()=>{},disconnect:()=>{}};const rooms=[];
 socketAuth(socket,error=>assert.equal(error,undefined));connectSocket(socket);assert.deepEqual(rooms,["order:"+id]);assert.notEqual(identity(signToken({role:"customer"},other)).owner,identity(customer()).owner);
});
test("signed kitchen/waiter roles and verified admin get only their permitted room",()=>{
 for(const role of ["kitchen","waiter","admin"]){const token=role==="admin"?admin():signToken({role},"staff-1");assert.deepEqual(identity(token).audiences,[role]);}
});
test("event audiences isolate new orders/waiter calls and customer status including served",()=>{
 assert.deepEqual(eventFor("order.new",record).audiences,["admin","kitchen","waiter"]);
 assert.deepEqual(eventFor("waiter.called",record).audiences,["admin","waiter"]);
 for(const status of ["pending","preparing","ready","served","cancelled"]){const event=eventFor("order.status",{...record,status});assert.ok(event.audiences.includes("order:"+id));assert.ok(!event.audiences.includes("order:"+other));assert.equal(event.status,status);}
});
test("subscription validates push provider, protocol, credentials and encryption keys (SSRF protection)",()=>{
 const valid={endpoint:"https://fcm.googleapis.com/fcm/send/mock",keys:{p256dh:"A".repeat(87),auth:"B".repeat(22)}};assert.deepEqual(validateSubscription(valid),valid);
 for(const endpoint of ["http://fcm.googleapis.com/test","https://127.0.0.1/test","https://fcm.googleapis.com.evil.test/x","https://user@fcm.googleapis.com/x","https://fcm.googleapis.com:8443/x","https://localhost/x"])assert.throws(()=>validateSubscription({...valid,endpoint}));
 assert.throws(()=>validateSubscription({...valid,keys:{auth:"bad",p256dh:"bad"}}));
});
const events=[],subscriptions=[],reads=[],emits=[],sends=[];
const match=(row,q)=>Object.entries(q).every(([k,v])=>{if(v&&typeof v==="object"){if(v.$in)return Array.isArray(row[k])?row[k].some(x=>v.$in.includes(x)):v.$in.includes(row[k]);if(v.$gt)return row[k]>v.$gt;if(v.$regex)return new RegExp(v.$regex).test(row[k]);}return row[k]===v;});
const query=rows=>({sort:()=>({limit:()=>({lean:async()=>rows})}),lean:async()=>rows,then:resolve=>Promise.resolve(rows).then(resolve)});
const NotificationModel={updateOne:async(filter,update)=>{if(events.some(e=>e.key===filter.key))return {upsertedCount:0};events.push(update.$setOnInsert);return {upsertedCount:1};},find:q=>query(events.filter(row=>match(row,q)))};
const SubscriptionModel={find:q=>query(subscriptions.filter(row=>match(row,q))),updateOne:async(filter,update)=>{const row=subscriptions.find(s=>match(s,filter));if(row)Object.assign(row,update.$set);else subscriptions.push({...filter,...update.$set});},deleteOne:async filter=>{const i=subscriptions.findIndex(s=>match(s,filter));if(i>=0)subscriptions.splice(i,1);}};
const ReadModel={find:q=>query(reads.filter(row=>match(row,q))),updateOne:async(filter,update)=>{if(!reads.some(row=>match(row,filter)))reads.push(update.$setOnInsert);}};
const service=createNotifications({to:rooms=>({emit:(name,event)=>emits.push({rooms,name,event})})},{NotificationModel,SubscriptionModel,ReadModel,env:{VAPID_PUBLIC_KEY:"fake-public",VAPID_PRIVATE_KEY:"fake-private",VAPID_SUBJECT:"mailto:fake@example.test",ADMIN_USERNAME:"test-admin"},transport:{setVapidDetails:()=>{},sendNotification:async(sub,payload)=>{sends.push({sub,payload:JSON.parse(payload)});if(sub.gone)throw {statusCode:410};}}});
test("stored event deduplicates Socket.IO and mock push; only matching unexpired recipients get delivery",async()=>{
 subscriptions.push({owner:"customer:"+id,subscription:{endpoint:"fake-own"},expiresAt:new Date(Date.now()+60000),language:"en"},{owner:"customer:"+other,subscription:{endpoint:"fake-other"},expiresAt:new Date(Date.now()+60000)},{owner:"waiter:1",subscription:{endpoint:"fake-staff"},expiresAt:new Date(Date.now()+60000)},{owner:"kitchen:expired",subscription:{endpoint:"expired"},expiresAt:new Date(0)});
 await service.publish("order.status",record);await service.publish("order.status",record);
 assert.equal(events.length,1);assert.equal(emits.length,1);assert.equal(sends.length,2);assert.ok(sends.every(s=>s.sub.endpoint!=="fake-other"));assert.equal(sends[0].payload.body,"Your order is ready");assert.equal(sends[0].payload.url,"/my-order/"+id);
 assert.ok(!("items" in emits[0].event));
});
test("expired push endpoints are removed and push failure cannot reject saved order notification",async()=>{
 subscriptions.push({_id:"gone",owner:"waiter:gone",subscription:{gone:true},expiresAt:new Date(Date.now()+60000)});
 await service.publish("waiter.called",{_id:other,tableNumber:4});assert.ok(!subscriptions.some(s=>s._id==="gone"));
 const failing=createNotifications({},{NotificationModel:{updateOne:async()=>{throw Error("fake database failure");}},SubscriptionModel,ReadModel,env:{},transport:{}});await assert.doesNotReject(()=>failing.publish("order.new",record));
});
test("no VAPID means in-app still works and sends no push",async()=>{
 const sent=[];const local=createNotifications({to:()=>({emit:()=>sent.push("socket")})},{NotificationModel:{updateOne:async()=>({upsertedCount:1})},SubscriptionModel,ReadModel,env:{},transport:{sendNotification:()=>sent.push("push")}});await local.publish("order.new",record);assert.deepEqual(sent,["socket"]);assert.equal(local.publicKey,null);
});
let server,base;before(async()=>{const app=express();app.use(express.json());app.set("notifications",service);app.use("/api/notifications",require("../src/routes/notificationRoutes"));server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port+"/api/notifications";});after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
async function request(path="",token=customer(),method="GET",body){const res=await fetch(base+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};}
test("inbox rejects invalid auth and another customer cannot see or acknowledge own-order events",async()=>{
 assert.equal((await request("","invalid")).status,401);
 const own=await request();assert.ok(own.body.some(e=>e.orderId===id));assert.ok(own.body.every(e=>!e.audiences));
 const foreign=await request("",signToken({role:"customer"},other));assert.equal(foreign.body.length,0);
 const key=events.find(e=>e.orderId===id).key;await request("/read",signToken({role:"customer"},other),"POST",{keys:[key]});assert.ok(!reads.some(r=>r.key===key));
 await request("/read",customer(),"POST",{keys:[key]});assert.equal((await request()).body.find(e=>e.key===key).read,true);assert.equal((await request()).body.find(e=>e.key===key).read,true);
});
test("subscription owner comes from JWT, not request body; unsubscribe cannot affect another owner",async()=>{
 const subscription={endpoint:"https://fcm.googleapis.com/fcm/send/test",keys:{p256dh:"A".repeat(87),auth:"B".repeat(22)}};
 const result=await request("/subscription",customer(),"POST",{subscription,language:"tr",owner:"admin:test-admin"});assert.equal(result.status,200);const row=subscriptions.find(s=>s.subscription.endpoint===subscription.endpoint);assert.equal(row.owner,"customer:"+id);assert.equal(row.language,"tr");
 await request("/subscription",signToken({role:"customer"},other),"DELETE",{endpoint:subscription.endpoint});assert.ok(subscriptions.includes(row));await request("/subscription",customer(),"DELETE",{endpoint:subscription.endpoint});assert.ok(!subscriptions.includes(row));
});

test("same status retry is atomic and emits only one saved-order notification",async()=>{
 let status="pending",publications=0,legacy=0;const seenFilters=[];
 const model={findOneAndUpdate:async(filter,update)=>{seenFilters.push(filter);if(status===update.status)return null;status=update.status;return {...record,status};},findById:async()=>({...record,status})};
 const filename=require.resolve("../src/models/Order");require.cache[filename]={id:filename,filename,loaded:true,exports:model};
 const telegram=require.resolve("../src/utils/telegram");require.cache[telegram]={id:telegram,filename:telegram,loaded:true,exports:{sendOrderNotification:async()=>{throw Error("Must not send Telegram");}}};
 const app=express();app.use(express.json());app.set("io",{to:()=>({emit:()=>legacy++})});app.set("notifications",{publish:async()=>publications++});app.use("/orders",require("../src/routes/orderRoutes"));const local=app.listen(0,"127.0.0.1");await new Promise(r=>local.once("listening",r));
 try{for(let i=0;i<2;i++){const response=await fetch("http://127.0.0.1:"+local.address().port+"/orders/"+id+"/status",{method:"PATCH",headers:{Authorization:"Bearer "+admin(),"Content-Type":"application/json"},body:JSON.stringify({status:"ready"})});assert.equal(response.status,200);assert.equal((await response.json()).status,"ready");}assert.equal(publications,1);assert.equal(legacy,2);assert.deepEqual(seenFilters[0],{_id:id,status:{$ne:"ready"}});}
 finally{local.closeAllConnections();await new Promise(r=>local.close(r));}
});
