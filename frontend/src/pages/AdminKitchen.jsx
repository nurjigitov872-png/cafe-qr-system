import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { fetchOrders, updateOrderStatus } from "../services/api";
import { socket } from "../services/socket";
import { useAdminAuth } from "./useAdminAuth";
export default function AdminKitchen() {
  useAdminAuth();
  const [orders, setOrders] = useState([]);
  const load = async () => { const data = await fetchOrders(); setOrders(data.filter((o)=>["pending","preparing","ready"].includes(o.status))); };
  useEffect(() => { load().catch((e) => alert(e.message)); }, []);
  useEffect(() => { const handler = () => load(); socket.on("order:new", handler); socket.on("order:updated", handler); return () => { socket.off("order:new", handler); socket.off("order:updated", handler); }; }, []);
  const updateStatus = async (id, status) => { await updateOrderStatus(id, status); await load(); };
  return <AdminLayout title="Kitchen"><div className="admin-cards-grid">{orders.map((order)=><div className="card kitchen-card" key={order._id}><div className="line-row"><h2>Стол №{order.tableNumber}</h2><span className={`status-badge ${order.status}`}>{order.status}</span></div><div className="list-box">{order.items.map((item,index)=><div className="line-row" key={index}><span>{item.name} × {item.qty}</span><strong>{item.price * item.qty} сом</strong></div>)}</div><div className="button-row"><button className="small-btn" onClick={()=>updateStatus(order._id, "preparing")}>preparing</button><button className="small-btn" onClick={()=>updateStatus(order._id, "ready")}>ready</button><button className="small-btn" onClick={()=>updateStatus(order._id, "served")}>served</button></div></div>)}</div></AdminLayout>;
}
