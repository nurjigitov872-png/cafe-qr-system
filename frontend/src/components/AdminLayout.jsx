import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./AdminUI";
import { socket } from "../services/socket";
import { formatCalendarDate } from "../utils/adminData";
import "../admin.css";
const links = [
  ["dashboard", "Башкаруу панели", "dashboard"], ["orders", "Заказдар", "orders"],
  ["products", "Товарлар", "products"], ["kitchen", "Ашкана", "kitchen"],
  ["waiter", "Официанттар", "waiter"], ["tables", "Столдордун QR-коддору", "qr"]
];
export default function AdminLayout({ title, subtitle, actions, children }) {
  const location = useLocation(), navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const sidebar = useRef(null), trigger = useRef(null);
  useEffect(() => { const media = window.matchMedia("(max-width: 700px)"); const update = () => { setMobile(media.matches); setOpen(false); }; media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => [...sidebar.current.querySelectorAll("a, button")];
    items()[0]?.focus();
    const handle = event => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const nodes = items(), first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handle);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", handle); trigger.current?.focus(); };
  }, [open, mobile]);
  const logout = () => { socket.disconnect(); localStorage.removeItem("admin_token"); localStorage.removeItem("admin"); navigate("/admin/login"); };
  return <div className={"pos-admin" + (open ? " pos-menu-open" : "")}>
    <a className="pos-skip" href="#admin-main">Мазмунга өтүү</a>
    {open && mobile && <button className="pos-backdrop" aria-label="Менюну жабуу" onClick={() => setOpen(false)} tabIndex={-1} />}
    <aside id="admin-sidebar" ref={sidebar} className="pos-sidebar" aria-label="Админ навигациясы" role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} inert={mobile && !open ? "" : undefined}>
      <Link to="/admin/dashboard" className="pos-brand" aria-label="Cafe QR — башкаруу панели"><span className="pos-brand-icon"><Icon name="waiter" size={25} /></span><span className="pos-brand-text">café<span className="pos-brand-dot">.</span><small>БАШКАРУУ СИСТЕМАСЫ</small></span></Link>
      <button className="pos-menu-close pos-icon-button" onClick={() => setOpen(false)} aria-label="Менюну жабуу"><Icon name="close" /></button>
      <p className="pos-nav-label">ИШ МЕЙКИНДИГИ</p>
      <nav>{links.map(([path, label, icon]) => <Link key={path} to={"/admin/" + path} title={label} aria-label={label} className={location.pathname === "/admin/" + path ? "pos-nav-item is-active" : "pos-nav-item"} aria-current={location.pathname === "/admin/" + path ? "page" : undefined}><Icon name={icon} /><span>{label}</span><Icon name="chevron" size={14} className="pos-nav-chevron" /></Link>)}</nav>
      <div className="pos-sidebar-bottom"><div className="pos-account"><span className="pos-avatar">А</span><span>Администратор<small>Ресторанды башкаруу</small></span></div><button className="pos-logout" onClick={logout} title="Чыгуу"><Icon name="logout" /><span>Чыгуу</span></button><small className="pos-sidebar-foot">Cafe QR · Ресторан үчүн</small></div>
    </aside>
    <div className="pos-workspace"><header className="pos-topbar"><div className="pos-topbar-left"><button ref={trigger} className="pos-icon-button pos-menu-toggle" aria-label="Менюну ачуу" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen(!open)}><Icon name="menu" /></button><span className="pos-topbar-label">Ресторанды башкаруу</span></div><div className="pos-topbar-right"><span className="pos-topbar-date">{formatCalendarDate(new Date())}</span><span className="pos-avatar pos-avatar--small" aria-label="Администратор">А</span></div></header>
    <main id="admin-main" className="pos-main" tabIndex={-1}><div className="pos-page-heading"><div><p className="pos-eyebrow">CAFE QR / БАШКАРУУ</p><h1>{title}</h1>{subtitle && <p className="pos-subtitle">{subtitle}</p>}</div>{actions && <div className="pos-heading-actions">{actions}</div>}</div>{children}<footer className="pos-footer"><span>café. <span>Күнүмдүк ишке так көзөмөл.</span></span><span>Бишкек убактысы · UTC+6</span></footer></main></div>
  </div>;
}
