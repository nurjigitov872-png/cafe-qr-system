// Dedicated push lab: no MongoDB connection, order API or Telegram import.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
function createPushLab(settings,{transport,serveStatic=true}={}){
 const origin=new URL(settings.PUSH_LAB_ORIGIN).origin;
 if(!settings.PUSH_LAB_ADMIN_PASSWORD||!settings.PUSH_LAB_JWT_SECRET)throw Error("Separate push-lab credentials are required");
 const real=settings.PUSH_LAB_ENABLE_REAL_PUSH==="true";
 if(real&&!origin.startsWith("https://"))throw Error("Real push lab requires an HTTPS public origin");
 process.env.APP_ENV="push-lab";process.env.NODE_ENV="development";process.env.ADMIN_USERNAME=settings.PUSH_LAB_ADMIN_USERNAME||"push-test-admin";process.env.ADMIN_PASSWORD=settings.PUSH_LAB_ADMIN_PASSWORD;process.env.JWT_SECRET=settings.PUSH_LAB_JWT_SECRET;
 const express=require("express"),{Server}=require("socket.io");
 const {socketAuth,connectSocket}=require("../src/utils/notificationPolicy"),{createNotifications}=require("../src/utils/notifications");
 const subscriptions=[],reads=[];
 const match=(row,q)=>Object.entries(q).every(([key,value])=>{if(value&&typeof value==="object"){if(value.$gt)return row[key]>value.$gt;if(value.$in)return value.$in.includes(row[key]);}return row[key]===value;});
 const Subscription={findOne:async q=>subscriptions.find(row=>match(row,q))||null,find:async()=>[],updateOne:async(q,update)=>{const row=subscriptions.find(row=>match(row,q));if(row)Object.assign(row,update.$set);else {if(subscriptions.length>=100)throw Error("Lab subscription capacity reached");subscriptions.push({...q,...update.$set});}},deleteOne:async q=>{const index=subscriptions.findIndex(row=>match(row,q));if(index>=0)subscriptions.splice(index,1);}};
 const rowsQuery=rows=>({sort:()=>({limit:()=>({lean:async()=>rows})}),lean:async()=>rows});
 const app=express();app.disable("x-powered-by");app.use(express.json({limit:"8kb"}));
 app.use((req,res,next)=>{if(req.get("Origin")&&req.get("Origin")!==origin)return res.sendStatus(403);next();});
 app.use("/api",(req,res,next)=>{res.set("Cache-Control","no-store");next();});
 let windowStart=Date.now(),loginAttempts=0;
 app.use("/api/auth/login",(req,res,next)=>{if(Date.now()-windowStart>=60000){windowStart=Date.now();loginAttempts=0;}if(++loginAttempts>20)return res.status(429).json({message:"Try later"});next();});
 app.use("/api/auth",require("../src/routes/authRoutes"));
 const server=http.createServer(app),io=new Server(server,{cors:{origin}});io.use(socketAuth);io.on("connection",connectSocket);
 const env={APP_ENV:"push-lab",PUSH_LAB_ENABLE_REAL_PUSH:String(real),NODE_ENV:"development",PUSH_TEST_ENABLED:"true",...(real?{VAPID_PUBLIC_KEY:settings.VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY:settings.VAPID_PRIVATE_KEY,VAPID_SUBJECT:settings.VAPID_SUBJECT}:{})};
 const notifications=createNotifications(io,{env,transport:transport||(real?require("web-push"):{}),SubscriptionModel:Subscription,NotificationModel:{find:()=>rowsQuery([])},ReadModel:{find:()=>rowsQuery(reads),updateOne:async()=>{}}});
 app.set("notifications",notifications);app.use("/api/notifications",require("../src/routes/notificationRoutes"));
 app.use("/api",(req,res)=>res.status(404).json({message:"Push lab has no order, product, payment or waiter API"}));
 if(serveStatic){const folder=path.resolve(__dirname,"../../frontend/dist/push-lab");if(!fs.existsSync(path.join(folder,"index.html")))throw Error("Build frontend/dist/push-lab first");const assets=fs.readdirSync(path.join(folder,"assets")).filter(name=>name.endsWith(".js"));if(!assets.some(name=>fs.readFileSync(path.join(folder,"assets",name),"utf8").includes(origin)))throw Error("Lab build must use PUSH_LAB_ORIGIN as VITE_API_URL and VITE_SOCKET_URL");app.use(express.static(folder,{setHeaders:(res,file)=>{if(file.endsWith("sw.js"))res.setHeader("Cache-Control","no-cache");}}));app.get("*",(req,res)=>res.sendFile(path.join(folder,"index.html")));}
 return {app,server,io,notifications,close:()=>new Promise(resolve=>io.close(resolve))};
}
if(require.main===module){try{const filename=path.resolve(__dirname,"../../.env.push-lab");const settings=require("dotenv").parse(fs.readFileSync(filename));const lab=createPushLab(settings);lab.server.listen(10002,"127.0.0.1",()=>console.log("Push lab listening on 127.0.0.1:10002. No database/order/Telegram API. No push is sent on startup."));process.on("SIGINT",()=>lab.close());}catch{console.error("Push lab could not start. Check private .env.push-lab, matching frontend build and port 10002. Details withheld.");process.exitCode=1;}}
module.exports={createPushLab};
