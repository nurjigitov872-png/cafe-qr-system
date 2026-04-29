import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { completeWaiterCall, fetchOrders, fetchWaiterCalls } from "../services/api";
import { socket } from "../services/socket";
import useAdminAuth from "./useAdminAuth";
export default function AdminWaiter() {
  useAdminAuth();
  const [calls, setCalls] = useState([]);
  const [orders, setOrders] = useState([]);
  const load = async () => { const [callsData, ordersData] = await Promise.all([fetchWaiterCalls(), fetchOrders()]); setCalls(callsData); setOrders(ordersData); };
  useEffect(() => { load().catch((e) => alert(e.message)); }, []);
  useEffect(() => { const handler = () => load(); ["waiter:new","waiter:updated","order:new","order:updated"].forEach((e)=>socket.on(e,handler)); return () => ["waiter:new","waiter:updated","order:new","order:updated"].forEach((e)=>socket.off(e,handler)); }, []);
  const openTables = [...new Set(orders.filter((o)=>o.status!=="cancelled").map((o)=>o.tableNumber))];
  return <AdminLayout title="Waiter"><div className="two-col-grid"><div className="card"><h3>Официант чакыруулар</h3><div className="list-box">{calls.map((call)=><div className="line-row" key={call._id}><div><b>Стол №{call.tableNumber}</b><div className="muted">{call.status}</div></div>{call.status==="pending" && <button className="small-btn" onClick={()=>completeWaiterCall(call._id).then(load)}>done</button>}</div>)}</div></div><div className="card"><h3>Ачык столдор</h3><div className="list-box">{openTables.map((table)=><div className="line-row" key={table}><span>Стол №{table}</span><strong>Активдүү</strong></div>)}</div></div></div></AdminLayout>;
}
