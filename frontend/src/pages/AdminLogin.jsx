import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../services/api";
export default function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin12345");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submit = async (e) => { e.preventDefault(); try { setLoading(true); const data = await loginAdmin(username, password); localStorage.setItem("admin_token", data.token); navigate("/admin/dashboard"); } catch (e) { alert(e.message); } finally { setLoading(false); } };
  return <div className="center-page"><form className="card auth-card" onSubmit={submit}><h1>Admin Login</h1><input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" /><input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" type="password" /><button className="submit-btn" disabled={loading}>{loading ? "Кирип жатат..." : "Кирүү"}</button></form></div>;
}
