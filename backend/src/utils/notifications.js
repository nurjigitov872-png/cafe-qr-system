const crypto=require("node:crypto");
const Notification=require("../models/Notification");
const Subscription=require("../models/PushSubscription");
const Read=require("../models/NotificationRead");
const {eventFor}=require("./notificationPolicy");
const messages={ky:{"order.new":"Жаңы заказ түштү","waiter.called":"Официант чакырылды",ready:"Заказыңыз даяр",served:"Заказыңыз берилди",status:"Заказдын статусу өзгөрдү"},ru:{"order.new":"Новый заказ","waiter.called":"Вызов официанта",ready:"Ваш заказ готов",served:"Ваш заказ подан",status:"Статус заказа изменён"},en:{"order.new":"New order","waiter.called":"Waiter requested",ready:"Your order is ready",served:"Your order has been served",status:"Order status updated"},tr:{"order.new":"Yeni sipariş","waiter.called":"Garson çağrıldı",ready:"Siparişiniz hazır",served:"Siparişiniz servis edildi",status:"Sipariş durumu güncellendi"}};
const hash=value=>crypto.createHash("sha256").update(value).digest("hex");
function createNotifications(io,{NotificationModel=Notification,SubscriptionModel=Subscription,ReadModel=Read,transport=require("web-push"),env=process.env}={}){
 let configured=!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
 if(configured){try{transport.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);}catch{configured=false;console.error("Push configuration invalid; in-app notifications remain available.");}}
 async function publish(kind,record){
  try{
   const event=eventFor(kind,record);
   const saved=await NotificationModel.updateOne({key:event.key},{$setOnInsert:event},{upsert:true});
   if(!saved.upsertedCount)return;
   io.to(event.audiences).emit("notification",event);
   if(!configured)return;
   // Customer subscriptions are isolated to their order; staff role to its room.
   const subscriptions=await SubscriptionModel.find({owner:{$in:event.audiences.map(a=>a.startsWith("order:")?"customer:"+a.slice(6):a=== "admin"?"admin:"+String(env.ADMIN_USERNAME||"").trim():null).filter(Boolean)},expiresAt:{$gt:new Date()}});
   const staff=await SubscriptionModel.find({owner:{$regex:"^(kitchen|waiter):"},expiresAt:{$gt:new Date()}});
   const targets=[...subscriptions,...staff.filter(s=>event.audiences.includes(s.owner.split(":")[0]))];
   await Promise.allSettled(targets.map(async sub=>{
    const words=messages[sub.language]||messages.ky;
    const text=words[event.kind]||words[event.status]||words.status;
    const customer=sub.owner.startsWith("customer:");
    const url=customer?"/my-order/"+event.orderId:sub.owner.startsWith("kitchen:")?"/admin/kitchen":"/admin/waiter";
    try{await transport.sendNotification(sub.subscription,JSON.stringify({id:event.key,title:"Café QR",body:text,url}),{TTL:300,timeout:5000});}
    catch(error){if([404,410].includes(error.statusCode))await SubscriptionModel.deleteOne({_id:sub._id});else console.error("Push delivery failed; details withheld.");}
   }));
  }catch{console.error("Notification delivery failed; details withheld.");}
 }
 const pushTester=require("./pushTest").createPushTester({Subscription:SubscriptionModel,transport,hash,env,configured});
 return {publish,pushTester,configured,publicKey:configured?env.VAPID_PUBLIC_KEY:null,Notification:NotificationModel,Subscription:SubscriptionModel,Read:ReadModel,hash};
}
module.exports={createNotifications};
