const {verifyToken}=require("../middleware/auth");
function identity(token){
 const claims=verifyToken(token);
 const role=claims.role;
 if(role==="admin" && claims.sub!==String(process.env.ADMIN_USERNAME||"").trim()) throw Error("Forbidden");
 if(!["admin","kitchen","waiter","customer"].includes(role)) throw Error("Forbidden");
 if(role==="customer"&&!/^[a-f0-9]{24}$/i.test(claims.sub)) throw Error("Forbidden");
 return {owner:role+":"+claims.sub, audiences:[role==="customer"?"order:"+claims.sub:role],role,sub:claims.sub,exp:claims.exp};
}
function socketAuth(socket,next){try{socket.data.notificationIdentity=identity(socket.handshake.auth?.token);socket.data.auth={exp:socket.data.notificationIdentity.exp};next();}catch{next(Error("Authentication required"));}}
function connectSocket(socket){const user=socket.data.notificationIdentity;for(const room of user.audiences)socket.join(room);const timer=setTimeout(()=>socket.disconnect(true),Math.max(0,user.exp*1000-Date.now()));timer.unref?.();socket.on("disconnect",()=>clearTimeout(timer));}
function eventFor(kind,record){
 const id=String(record._id),status=record.status;
 const audiences=kind==="waiter.called"?["admin","waiter"]:kind==="order.new"?["admin","kitchen","waiter"]:["admin","kitchen","waiter","order:"+id];
 const version=kind==="order.status"?":"+status+":"+(record.updatedAt?new Date(record.updatedAt).toISOString():status):"";
 return {key:kind+":"+id+version,kind,audiences,...(kind.startsWith("order.")?{orderId:id,status}:{}),tableNumber:Number(record.tableNumber),createdAt:new Date(),expiresAt:new Date(Date.now()+7*86400000)};
}
const endpointHosts=new Set(["fcm.googleapis.com","updates.push.services.mozilla.com","updates-autopush.stage.mozaws.net","web.push.apple.com","wns2-db5p.notify.windows.com"]);
function validateSubscription(value){
 if(!value||typeof value.endpoint!=="string"||value.endpoint.length>2048)throw Error("Invalid subscription");
 const url=new URL(value.endpoint);
 if(url.protocol!=="https:"||url.port||url.username||url.password||url.hash||!(endpointHosts.has(url.hostname)||url.hostname.endsWith(".notify.windows.com")))throw Error("Invalid endpoint");
 const keys=value.keys;
 if(!keys||!/^[-_A-Za-z0-9]{87}$/.test(keys.p256dh)||!/^[-_A-Za-z0-9]{22}$/.test(keys.auth))throw Error("Invalid push keys");
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
module.exports={identity,socketAuth,connectSocket,eventFor,validateSubscription};
