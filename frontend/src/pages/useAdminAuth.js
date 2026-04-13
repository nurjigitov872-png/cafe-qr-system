import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMe } from "../services/api";
export const useAdminAuth = () => {
  const navigate = useNavigate();
  useEffect(() => { fetchMe().catch(() => { localStorage.removeItem("admin_token"); navigate("/admin/login"); }); }, [navigate]);
};
