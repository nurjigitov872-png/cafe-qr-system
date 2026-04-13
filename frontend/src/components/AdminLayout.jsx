import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
const links=[{to:"/admin/dashboard",label:"Dashboard"},{to:"/admin/orders",label:"Orders"},{to:"/admin/products",label:"Products"},{to:"/admin/kitchen",label:"Kitchen"},{to:"/admin/waiter",label:"Waiter"},{to:"/admin/tables",label:"Tables QR"}];
export default function AdminLayout({ title, children }) {
  const location=useLocation(), navigate=useNavigate();
  const logout=()=>{ localStorage.removeItem("admin_token"); navigate("/admin/login"); };
  return <div className="admin-shell"><aside className="admin-sidebar"><div className="brand">Cafe QR Admin</div><nav>{links.map(link=><Link key={link.to} className={location.pathname===link.to?"active":""} to={link.to}>{link.label}</Link>)}</nav><button className="logout-btn" onClick={logout}>Logout</button></aside><section className="admin-content"><div className="admin-topbar"><h1>{title}</h1></div>{children}</section></div>;
}
