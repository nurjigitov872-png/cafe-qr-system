import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function useAdminAuth() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");

    if (!token) {
      navigate("/admin/login", { replace: true });
    }

    setLoading(false);
  }, [navigate]);

  return { loading };
}