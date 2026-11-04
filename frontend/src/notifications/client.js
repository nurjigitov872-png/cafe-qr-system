export const API=import.meta.env.VITE_API_URL||"https://cafe-backend-weo1.onrender.com/api";
export const SOCKET=import.meta.env.VITE_SOCKET_URL||new URL(API).origin;
export async function notificationRequest(token,path="",options={}){const response=await fetch(API+"/notifications"+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok){const error=new Error("Notification request failed");error.code=data.code;error.status=response.status;throw error;}return data;}
export const supportsPush=(scope=window)=>!!(scope.isSecureContext&&scope.Notification&&scope.PushManager&&scope.navigator.serviceWorker);
export function applicationKey(value){const raw=atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
// Called only by the explicit button; permission is requested before any await.
export async function enablePush({token,language,config,scope=window,request=notificationRequest}){
 if(!supportsPush(scope))return "unsupported";
 if(!config?.enabled||!config.publicKey)return "unconfigured";
 const permission=await scope.Notification.requestPermission();
 if(permission!=="granted")return "denied";
 let timer;let registration;
 try{registration=await Promise.race([scope.navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Service worker unavailable")),10000);})]);}finally{clearTimeout(timer);}
 const existing=await registration.pushManager.getSubscription();
 const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(config.publicKey)});
 await request(token,"/subscription",{method:"POST",body:{subscription:subscription.toJSON(),language}});
 return "enabled";
}

export async function revokeCurrentPush(token){
 if(!("serviceWorker" in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration();const sub=await registration?.pushManager.getSubscription();
 if(!sub)return;
 try{await notificationRequest(token,"/subscription",{method:"DELETE",body:{endpoint:sub.endpoint},signal:AbortSignal.timeout(5000)});}finally{await sub.unsubscribe();}
}

export async function pushDiagnostics(scope=window){
 const info={secureContext:!!scope.isSecureContext,pushSupported:supportsPush(scope),permission:scope.Notification?.permission||"unsupported",serviceWorker:"unsupported",controlled:false,subscription:false};
 if(!scope.navigator.serviceWorker)return info;
 const registration=await scope.navigator.serviceWorker.getRegistration();
 info.serviceWorker=registration?.active?.state||registration?.installing?.state||registration?.waiting?.state||"not-registered";
 info.controlled=!!scope.navigator.serviceWorker.controller;
 info.subscription=!!await registration?.pushManager?.getSubscription();
 if(registration?.active&&scope.MessageChannel){
  info.worker=await new Promise(resolve=>{const channel=new scope.MessageChannel();const done=value=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};const timer=setTimeout(()=>done({state:"timeout"}),1500);channel.port1.onmessage=event=>done(event.data);registration.active.postMessage({type:"push-diagnostics"},[channel.port2]);});
 }
 return info; // Never expose endpoint, subscription keys, JWT or VAPID secrets.
}
export async function sendTestPush(token,delaySeconds=15,scope=window){
 const registration=await scope.navigator.serviceWorker?.getRegistration();
 const sub=await registration?.pushManager.getSubscription();
 if(!sub){const error=new Error("No subscription");error.code="subscriptionMissing";throw error;}
 return notificationRequest(token,"/test-push",{method:"POST",body:{endpoint:sub.endpoint,delaySeconds}});
}
