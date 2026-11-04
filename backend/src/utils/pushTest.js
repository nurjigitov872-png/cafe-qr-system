const crypto=require("node:crypto");
function createPushTester({Subscription,transport,hash,env,configured,now=Date.now,schedule=setTimeout}) {
 const enabled=env.PUSH_TEST_ENABLED==="true"&&env.NODE_ENV!=="production";
 const attempts=new Map(),states=new Map();let globalWindow=0,globalCount=0;
 const prune=()=>{for(const [key,time] of attempts)if(now()-time>=60000){attempts.delete(key);states.delete(key);}};
 const result=(status,code,extra={})=>({status,body:{code,...extra}});
 async function send(user,endpointHash){
  if(user.exp*1000<=now()){states.set(user.owner,{state:"expired"});return result(401,"tokenExpired");}
  const sub=await Subscription.findOne({owner:user.owner,endpointHash,expiresAt:{$gt:new Date(now())}});
  if(!sub)return result(404,"subscriptionMissing");
  const words={ky:"Бул коопсуз тесттик билдирүү. Заказ түзүлгөн жок.",ru:"Безопасное тестовое уведомление. Заказ не создан.",en:"Safe test notification. No order was created.",tr:"Güvenli test bildirimi. Sipariş oluşturulmadı."};
  try{
   await transport.sendNotification(sub.subscription,JSON.stringify({id:"push-test:"+crypto.randomUUID(),title:"Café QR · Test",body:words[sub.language]||words.ky,url:"/"}),{TTL:120,urgency:"normal",timeout:5000});
   states.set(user.owner,{state:"accepted",at:new Date(now()).toISOString()});
   return result(200,"pushAccepted");
  }catch(error){
   const code=[404,410].includes(error.statusCode)?"subscriptionExpired":[401,403].includes(error.statusCode)?"vapidRejected":error.statusCode===429?"providerRateLimited":"pushDeliveryFailed";
   states.set(user.owner,{state:code,at:new Date(now()).toISOString()});
   if([404,410].includes(error.statusCode))await Subscription.deleteOne({owner:user.owner,endpointHash});
   return result(502,code);
  }
 }
 async function test(user,body){
  if(!enabled)return result(404,"pushTestDisabled");
  if(!configured)return result(503,"pushNotConfigured");
  if(!body||Object.keys(body).some(key=>!["endpoint","delaySeconds"].includes(key))||typeof body.endpoint!=="string"||body.endpoint.length>2048||![0,15].includes(body.delaySeconds??0))return result(400,"invalidPushTest");
  prune();const last=attempts.get(user.owner);
  if(last!==undefined&&now()-last<60000)return result(429,"pushTestRateLimited",{retryAfter:Math.ceil((60000-(now()-last))/1000)});
  if(now()-globalWindow>=3600000){globalWindow=now();globalCount=0;}
  if(globalCount>=60||attempts.size>=1000)return result(429,"pushTestRateLimited",{retryAfter:60});
  // Body owner/role/recipient/payload are never accepted. Resolve this JWT's device only.
  const endpointHash=hash(body.endpoint);
  const sub=await Subscription.findOne({owner:user.owner,endpointHash,expiresAt:{$gt:new Date(now())}});
  if(!sub)return result(404,"subscriptionMissing");
  // Reserve before awaiting the provider, including concurrent clicks.
  if(attempts.has(user.owner)&&now()-attempts.get(user.owner)<60000)return result(429,"pushTestRateLimited",{retryAfter:60});
  if(globalCount>=60)return result(429,"pushTestRateLimited",{retryAfter:60});
  attempts.set(user.owner,now());globalCount++;
  if(body.delaySeconds===15){
   states.set(user.owner,{state:"scheduled",at:new Date(now()).toISOString()});
   const timer=schedule(()=>send(user,endpointHash).catch(()=>states.set(user.owner,{state:"pushDeliveryFailed"})),15000);timer?.unref?.();
   return result(202,"pushScheduled",{delaySeconds:15});
  }
  return send(user,endpointHash);
 }
 const diagnostics=user=>{prune();return {testEnabled:enabled,configured,lastTest:states.get(user.owner)||{state:"none"},rateLimitSeconds:60};};
 return {enabled,test,diagnostics};
}
module.exports={createPushTester};
