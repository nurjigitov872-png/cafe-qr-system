import React from "react";
import AdminLayout from "../components/AdminLayout";
import useAdminAuth from "./useAdminAuth";
export default function PushTestPage(){
 const {loading}=useAdminAuth();
 return <AdminLayout title="Web Push текшерүүсү" subtitle="Android Chrome · өз түзмөгүңүз үчүн"><section className="pos-panel" style={{padding:24}}><p>{loading?"Уруксат текшерилүүдө…":"Төмөнкү 🔔 белгисин ачыңыз. Push'ту кол менен иштетип, андан кийин тесттик push жөнөтүңүз."}</p><p>Тест 15 секундга кечиктирилет: Chrome'ду фонго өткөрүп же экранды кулпулап текшере аласыз. Бул барак өзү push жөнөтпөйт жана заказ түзбөйт.</p><p>«Push диагностикасы» HTTPS, уруксат, service worker, subscription жана акыркы тест абалын көрсөтөт. Тест баскычы backend'де атайын иштетилгенде гана чыгат.</p></section></AdminLayout>;
}
