import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMe } from "../services/api";
import { socket } from "../services/socket";

export default function useAdminAuth() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        if (!localStorage.getItem("admin_token")) throw new Error("Login required");
        await fetchMe();
        if (active) socket.connect();
      } catch {
        if (active) {
          socket.disconnect();
          localStorage.removeItem("admin_token");
          navigate("/admin/login", { replace: true });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    check();
    return () => { active = false; socket.disconnect(); };
  }, [navigate]);

  return { loading };
}
