import React, { useState } from "react";
import { loginAdmin } from "../services/api";
import { Icon } from "../components/AdminUI";
import "../admin.css";
export default function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const login = async event => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const data = await loginAdmin(username, password);
      if (!data.token) throw new Error("Login failed");
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin", JSON.stringify(data.admin || { username }));
      window.location.href = "/admin/dashboard";
    } catch { setError("Кирүү мүмкүн болгон жок. Логинди, сырсөздү жана интернет байланышын текшериңиз."); }
    finally { setLoading(false); }
  };
  return <div className="pos-login"><section className="pos-login-story"><div className="pos-brand"><span className="pos-brand-icon"><Icon name="waiter" size={25} /></span><span className="pos-brand-text">café<span className="pos-brand-dot">.</span><small>БАШКАРУУ СИСТЕМАСЫ</small></span></div><div><h1>Мыкты тейлөө.<br /><span>Так башкаруу.</span></h1><p>Заказдар, ашкана жана тейлөө — рестораныңыздын күнүмдүк иши бир жерде.</p></div><small>Cafe QR · Ресторан үчүн иштелип чыккан</small></section><main className="pos-login-form-wrap"><form className="pos-login-form" onSubmit={login}><span className="pos-brand-icon"><Icon name="lock" size={22} /></span><h2>Кош келиңиз</h2><p>Башкаруу панелине кирүү үчүн маалыматтарды жазыңыз.</p><label className="pos-field">Админ логини<input autoComplete="username" name="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Логин" disabled={loading} /></label><label className="pos-field">Сырсөз<input autoComplete="current-password" name="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Сырсөздү жазыңыз" type="password" disabled={loading} /></label>{error && <div className="pos-alert" role="alert">{error}</div>}<button className="pos-button pos-button--primary" disabled={loading} type="submit">{loading ? <><span className="pos-spinner" />Кирип жатат…</> : <>Башкаруу панелине кирүү<Icon name="arrow" size={17} /></>}</button><span className="pos-login-security"><Icon name="lock" size={13} />Администратор үчүн кирүү</span></form></main></div>;
}
