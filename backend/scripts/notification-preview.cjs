// Isolated local demo: no dotenv, MongoDB connection, Telegram or real push.
const http=require("node:http"),crypto=require("node:crypto"),path=require("node:path");
const {pathToFileURL}=require("node:url");
process.env.APP_ENV="local";
process.env.JWT_SECRET=crypto.randomBytes(48).toString("hex");
process.env.ADMIN_USERNAME="notification-demo-admin";
const {Server}=require("socket.io");
const {signToken}=require("../src/middleware/auth");
const {socketAuth,connectSocket}=require("../src/utils/notificationPolicy");
const {createNotifications}=require("../src/utils/notifications");
const express=require("express"),cors=require("cors");
const root=path.resolve(__dirname,"../.."),frontend=path.join(root,"frontend");
const manifest=require(path.join(frontend,"src/data/menu15-draft.json"));
const products=manifest.products.map(entry=>({...entry.source,_id:entry.productId,available:true,options:entry.source.options.map((option,index)=>({...option,_id:"demo-option-"+index}))}));
const id="000000000000000000000001";
const order={_id:id,tableNumber:12,status:"pending",orderType:"dinein",paymentMethod:"cash",paymentStatus:"pending",items:[{productId:products[0]._id,name:products[0].name,price:products[0].price,qty:1}],totalAmount:products[0].price,createdAt:new Date(),updatedAt:new Date()};
const events=[],subscriptions=[],reads=[],calls=[];
const match=(row,query)=>Object.entries(query).every(([key,value])=>{if(value&&typeof value==="object"){if(value.$in)return Array.isArray(row[key])?row[key].some(item=>value.$in.includes(item)):value.$in.includes(row[key]);if(value.$gt)return row[key]>value.$gt;if(value.$regex)return new RegExp(value.$regex).test(row[key]);}return row[key]===value;});
const query=rows=>({sort:()=>({limit:()=>({lean:async()=>[...rows].reverse()})}),lean:async()=>rows,then:resolve=>Promise.resolve(rows).then(resolve)});
const NotificationModel={updateOne:async(filter,update)=>{if(events.some(e=>e.key===filter.key))return {upsertedCount:0};events.push(update.$setOnInsert);return {upsertedCount:1};},find:filter=>query(events.filter(row=>match(row,filter)))};
const SubscriptionModel={find:filter=>query(subscriptions.filter(row=>match(row,filter))),deleteOne:async()=>{}};
const ReadModel={find:filter=>query(reads.filter(row=>match(row,filter))),updateOne:async(filter,update)=>{if(!reads.some(row=>match(row,filter)))reads.push(update.$setOnInsert);}};
const app=express();app.use(cors({origin:"http://localhost:5174"}));app.use(express.json());
const server=http.createServer(app),io=new Server(server,{cors:{origin:"http://localhost:5174"}});io.use(socketAuth);io.on("connection",connectSocket);
const notifications=createNotifications(io,{NotificationModel,SubscriptionModel,ReadModel,env:{},transport:{}});app.set("notifications",notifications);app.use("/api/notifications",require("../src/routes/notificationRoutes"));
const admin=signToken({role:"admin"},process.env.ADMIN_USERNAME),customer=signToken({role:"customer"},id);
app.get("/api/products",(req,res)=>res.json(products));
app.get("/api/auth/me",(req,res)=>res.json({username:process.env.ADMIN_USERNAME,role:"admin"}));
app.get("/api/orders",(req,res)=>res.json([order]));app.get("/api/orders/:id",(req,res)=>res.json(order));app.get("/api/waiter-calls",(req,res)=>res.json(calls));
function legacyOrder(){io.to(["admin","kitchen","waiter"]).emit("order:updated",order);}
app.patch("/api/orders/:id/status",async(req,res)=>{if(!["pending","preparing","ready","served","cancelled"].includes(req.body.status))return res.sendStatus(400);order.status=req.body.status;order.updatedAt=new Date();await notifications.publish("order.status",order);legacyOrder();res.json(order);});
app.patch("/api/waiter-calls/:id/done",(req,res)=>{const call=calls.find(c=>c._id===req.params.id);if(!call)return res.sendStatus(404);call.status="done";io.to(["admin","waiter"]).emit("waiter-call-updated",call);res.json(call);});
app.post("/simulate/:kind",async(req,res)=>{const kind=req.params.kind;if(kind==="new"){order.status="pending";await notifications.publish("order.new",order);io.to(["admin","kitchen","waiter"]).emit("order:new",order);}else if(kind==="waiter"){const call={_id:crypto.randomBytes(12).toString("hex"),tableNumber:12,status:"pending",createdAt:new Date()};calls.push(call);await notifications.publish("waiter.called",call);io.to(["admin","waiter"]).emit("waiter-call",call);}else if(["ready","served"].includes(kind)){order.status=kind;order.updatedAt=new Date();await notifications.publish("order.status",order);legacyOrder();}else return res.sendStatus(400);res.json({mock:true});});
app.post("/api/orders",(req,res)=>res.status(403).json({message:"Demo only: order creation disabled"}));app.post("/api/waiter-calls",(req,res)=>res.status(403).json({message:"Use demo controls; real calls are disabled"}));
app.get("/",(req,res)=>res.type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notification demo</title><body style="font:18px system-ui;padding:24px;background:#faf8f3"><h1>Коопсуз notification demo</h1><p>MongoDB, Telegram жана чыныгы push колдонулбайт. Бул жасалма окуялар гана.</p><p><a target="_blank" href="http://localhost:5174/notification-preview?view=customer">Кардар</a> · <a target="_blank" href="http://localhost:5174/notification-preview?view=kitchen">Ашкана</a> · <a target="_blank" href="http://localhost:5174/notification-preview?view=waiter">Официант</a></p>${[["new","Жаңы заказ"],["waiter","Официант чакыруу"],["ready","Даяр"],["served","Берилди"]].map(([kind,label])=>`<button style="padding:16px;margin:8px" onclick="fetch('/simulate/${kind}',{method:'POST'}).then(()=>document.querySelector('output').textContent='Mock event sent')">${label}</button>`).join("")}<p><output></output></p>`));
let vite;
(async()=>{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(10001,"127.0.0.1",resolve);});
 process.env.VITE_APP_ENV="local";process.env.VITE_API_URL="http://localhost:10001/api";process.env.VITE_SOCKET_URL="http://localhost:10001";
 const {createServer}=await import(pathToFileURL(path.join(frontend,"node_modules/vite/dist/node/index.js")).href);
 const react=(await import(pathToFileURL(require.resolve(path.join(frontend,"node_modules/@vitejs/plugin-react"))).href)).default;
 const bootstrap={name:"mock-notification-bootstrap",configureServer(dev){dev.middlewares.use((req,res,next)=>{if(!req.url.startsWith("/notification-preview"))return next();const view=new URL(req.url,"http://localhost:5174").searchParams.get("view");const target=view==="kitchen"?"/admin/kitchen":view==="waiter"?"/admin/waiter":"/my-order/"+id;res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<!doctype html><script>localStorage.setItem("admin_token",'+JSON.stringify(admin)+');localStorage.setItem("order_token_'+id+'",'+JSON.stringify(customer)+');location.replace('+JSON.stringify(target)+');</script>');});}};
 vite=await createServer({root:frontend,envDir:false,configFile:false,plugins:[bootstrap,react()],server:{host:"localhost",port:5174,strictPort:true}});await vite.listen();console.log("Isolated MOCK controls: http://localhost:10001/");console.log("Demo frontend: http://localhost:5174/notification-preview?view=customer");
})().catch(async()=>{console.error("Mock preview failed; check ports 10001 and 5174 and installed dependencies.");if(vite)await vite.close();io.close();process.exitCode=1;});
async function stop(){if(vite)await vite.close();io.close();}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
