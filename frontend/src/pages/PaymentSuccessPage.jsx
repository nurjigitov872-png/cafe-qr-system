import React from "react";
import { useSearchParams } from "react-router-dom";
import MyOrderPage from "./MyOrderPage";
export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  return <MyOrderPage orderIdOverride={params.get("orderId") || ""} paymentReturn />;
}
