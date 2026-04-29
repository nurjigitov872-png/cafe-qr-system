import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const login = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        alert(data.message || "Логин же пароль туура эмес");
        return;
      }

      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin", JSON.stringify(data.admin || { username }));

      window.location.href = "/admin/dashboard";
    } catch (error) {
      alert("Серверге туташуу катасы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-page">
      <form className="card auth-card" onSubmit={login}>
        <h1>Admin Login</h1>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />

        <button className="submit-btn" disabled={loading}>
          {loading ? "Кирип жатат..." : "Кирүү"}
        </button>
      </form>
    </div>
  );
}