import React,{useEffect,useRef,useState} from "react";
import {useLocation} from "react-router-dom";
import {io} from "socket.io-client";
import useCustomerPreferences from "../i18n/useCustomerPreferences";
import {notificationWords,notificationText,mergeNotifications} from "../notifications/messages";
import {notificationRequest,enablePush,supportsPush,pushDiagnostics,sendTestPush} from "../notifications/client";
import { createNotificationSound, shouldPlayNotification } from "../notifications/sound";
import { SOCKET } from "../config/connections.js";
import "../notifications/notifications.css";
export default function NotificationCenter(){
 const location=useLocation();
 const admin=location.pathname.startsWith("/admin/")&&location.pathname!=="/admin/login";
 const orderId=/^\/my-order\/([a-f0-9]{24})$/i.exec(location.pathname)?.[1]||(location.pathname==="/payment-success"?new URLSearchParams(location.search).get("orderId"):null);
 const token=localStorage.getItem(admin?"admin_token":"order_token_"+orderId);
 const {language:customerLanguage,theme}=useCustomerPreferences();
 const language=admin?"ky":customerLanguage,words=notificationWords(language);
 const [items,setItems]=useState([]),[open,setOpen]=useState(false),[toast,setToast]=useState(null),[status,setStatus]=useState("connecting"),[message,setMessage]=useState(""),[config,setConfig]=useState(null),[sound,setSound]=useState(false),[busy,setBusy]=useState(false),[push,setPush]=useState(false);
 const [soundStatus,setSoundStatus]=useState(""),[soundBusy,setSoundBusy]=useState(false);
 const [diagnostics,setDiagnostics]=useState(null),[testResult,setTestResult]=useState("");
 const audio=useRef(null),soundRef=useRef(false),seen=useRef(new Set()),toastTimer=useRef(null);
 const active=!!token&&(admin||!!orderId);
 useEffect(()=>{
  setItems([]);setOpen(false);setToast(null);setConfig(null);setMessage("");setDiagnostics(null);setTestResult("");seen.current=new Set();
  if(!active)return;
  let alive=true;const connection=io(SOCKET,{auth:{token},transports:["websocket","polling"]});
  const add=(event,live=true)=>{
   if(!event?.key||(!admin&&event.orderId!==orderId))return;
   const fresh=!seen.current.has(event.key);seen.current.add(event.key);
   if(!alive)return;setItems(old=>mergeNotifications(old,[event]));
   if(live&&fresh){setToast(event);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000);
    if(soundRef.current&&shouldPlayNotification(event,{live,fresh})){
      playChime(false);
    }
   }
   if(!admin&&live&&fresh)window.dispatchEvent(new CustomEvent("cafe:order-status",{detail:event}));
  };
  const sync=async()=>{try{const rows=await notificationRequest(token);if(!alive)return;for(const row of rows)add(row,false);}catch{if(alive)setMessage("error");}};
  connection.on("connect",()=>{setStatus("online");sync();window.dispatchEvent(new Event("cafe:order-refresh"));});connection.on("disconnect",()=>setStatus("offline"));connection.on("connect_error",()=>setStatus("offline"));connection.on("notification",add);
  sync();notificationRequest(token,"/config").then(c=>{if(alive)setConfig(c);}).catch(()=>{});
  const interval=setInterval(sync,30000);const onVisible=()=>{if(document.visibilityState==="visible"){sync();window.dispatchEvent(new Event("cafe:order-refresh"));}};document.addEventListener("visibilitychange",onVisible);
  const localMessage=e=>add(e.detail,true);window.addEventListener("cafe:notification",localMessage);
  const workerMessage=e=>{if(e.data?.type==="notification")sync();};navigator.serviceWorker?.addEventListener("message",workerMessage);
  return()=>{alive=false;window.removeEventListener("cafe:notification",localMessage);connection.disconnect();clearInterval(interval);clearTimeout(toastTimer.current);document.removeEventListener("visibilitychange",onVisible);navigator.serviceWorker?.removeEventListener("message",workerMessage);};
 },[active,token,admin,orderId]);
 useEffect(()=>()=>{audio.current?.close();},[]);
 // Updating an existing subscription never prompts and keeps push language current.
 useEffect(()=>{if(!active||!supportsPush()||Notification.permission!=="granted")return;let alive=true;navigator.serviceWorker.getRegistration().then(async registration=>{const sub=await registration?.pushManager.getSubscription();if(sub&&alive){await notificationRequest(token,"/subscription",{method:"POST",body:{subscription:sub.toJSON(),language}});if(alive)setPush(true);}}).catch(()=>{});return()=>{alive=false;};},[active,token,language]);
 const playChime=async(gesture)=>{
  try{
    if(!audio.current){
      if(!gesture)throw {code:"soundBlocked"};
      audio.current=createNotificationSound(window,state=>{if(soundRef.current&&state==="soundBlocked")setSoundStatus(state);});
    }
    await audio.current.playback({gesture});
    setSoundStatus("soundPlayed");
    return true;
  }catch(error){setSoundStatus(error.code||"soundFailed");return false;}
 };
 if(!active)return null;
 const playTestSound=async(enable=false)=>{
  if(soundBusy)return;
  setSoundBusy(true);
  try{
    const played=await playChime(true);
    if(played&&enable){soundRef.current=true;setSound(true);}
  }finally{setSoundBusy(false);}
 };
 const toggleSound=()=>{if(soundRef.current){soundRef.current=false;setSound(false);setSoundStatus("soundMuted");}else playTestSound(true);};
 const subscribe=async()=>{setBusy(true);try{const result=await enablePush({token,language,config});setMessage(result);setPush(result==="enabled");}catch{setMessage("error");}finally{setBusy(false);}};
 const unsubscribe=async()=>{setBusy(true);try{const registration=await navigator.serviceWorker.getRegistration();const sub=await registration?.pushManager.getSubscription();if(sub){await notificationRequest(token,"/subscription",{method:"DELETE",body:{endpoint:sub.endpoint}});await sub.unsubscribe();}setPush(false);setMessage("");}catch{setMessage("error");}finally{setBusy(false);}};
 const inspectPush=async()=>{try{const [browser,server]=await Promise.all([pushDiagnostics(),notificationRequest(token,"/diagnostics")]);setDiagnostics({browser,server});}catch{setTestResult("pushTestUnavailable");}};
 const testPush=async()=>{setBusy(true);try{const result=await sendTestPush(token,15);setTestResult(result.code);}catch(error){setTestResult(error.code||"pushDeliveryFailed");}finally{setBusy(false);}};
 const markRead=async()=>{try{const keys=items.filter(n=>!n.read).map(n=>n.key);await notificationRequest(token,"/read",{method:"POST",body:{keys}});setItems(old=>old.map(n=>({...n,read:true})));}catch{setMessage("error");}};
 const unread=items.filter(n=>!n.read).length;
 return <aside className="qr-notifications" data-theme={admin?"dark":theme} aria-label={words.bell}><button className="qr-bell" aria-label={words.bell+" ("+unread+")"} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>🔔 <span>{words.bell}</span>{unread>0&&<b>{unread}</b>}</button>{soundStatus==="soundBlocked"&&!open&&<p className="qr-toast" role="alert">{words.soundBlocked}</p>}{toast&&<div className="qr-toast" role="status">{notificationText(toast,language)}<button aria-label="×" onClick={()=>setToast(null)}>×</button></div>}{open&&<section className="qr-notification-panel"><strong>{words.bell}</strong><small role="status">{words[status]}</small><div className="qr-notification-controls"><button disabled={busy} onClick={push?unsubscribe:subscribe}>{push?words.off:words.push}</button><button disabled={soundBusy} aria-pressed={sound} onClick={toggleSound}>{sound?words.mute:words.sound}</button><button disabled={!unread} onClick={markRead}>{words.read}</button><button disabled={soundBusy} onClick={()=>playTestSound()}>{words.testSound}</button>{config?.testEnabled&&<><button disabled={busy||!push} onClick={testPush}>{words.testPush}</button><button disabled={busy} onClick={inspectPush}>{words.pushDiagnostics}</button></>}</div>{testResult&&<p role="status">{words[testResult]||words.pushDeliveryFailed}</p>}{diagnostics&&<pre className="qr-push-diagnostics" aria-label={words.pushDiagnostics}>{JSON.stringify(diagnostics,null,2)}</pre>}{soundStatus&&<p className="qr-sound-status" role="status">{words[soundStatus]||words.soundFailed}</p>}{message&&<p role="status">{words[message]}</p>}<ul>{items.length?items.map(n=><li key={n.key} className={n.read?"":"is-unread"}><span>{notificationText(n,language)}</span><time>{new Date(n.createdAt).toLocaleTimeString(language,{hour:"2-digit",minute:"2-digit"})}</time></li>):<li>{words.empty}</li>}</ul></section>}</aside>;
}
