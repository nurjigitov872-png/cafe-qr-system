import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import MenuPage from "./pages/MenuPage";
import SuccessPage from "./pages/SuccessPage";
import MyOrderPage from "./pages/MyOrderPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";

import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrders from "./pages/AdminOrders";
import AdminProducts from "./pages/AdminProducts";
import AdminKitchen from "./pages/AdminKitchen";
import AdminWaiter from "./pages/AdminWaiter";
import AdminTables from "./pages/AdminTables";

function RequireAdmin({ children }) {
  const token = localStorage.getItem("admin_token");
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/table/1" replace />} />
      <Route path="/table/:tableId" element={<MenuPage />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      <Route path="/my-order/:orderId" element={<MyOrderPage />} />

      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/admin/dashboard"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/orders"
        element={
          <RequireAdmin>
            <AdminOrders />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/products"
        element={
          <RequireAdmin>
            <AdminProducts />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/kitchen"
        element={
          <RequireAdmin>
            <AdminKitchen />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/waiter"
        element={
          <RequireAdmin>
            <AdminWaiter />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/tables"
        element={
          <RequireAdmin>
            <AdminTables />
          </RequireAdmin>
        }
      />
    </Routes>
  );
}