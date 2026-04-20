const API_URL =
  import.meta.env.VITE_API_URL || "https://cafe-backend-weo1.onrender.com/api";

const parseResponse = async (res) => {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Server error");
  }

  return data;
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const getToken = () => localStorage.getItem("admin_token");

export const authHeaders = () => {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};

export const fetchProducts = async (params = {}) => {
  const res = await fetch(`${API_URL}/products${buildQuery(params)}`);
  return parseResponse(res);
};

export const createOrder = async (orderData) => {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  });

  return parseResponse(res);
};

export const submitOrder = async (order) => {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  return parseResponse(res);
};

export const getOrderById = async (id) => {
  const res = await fetch(`${API_URL}/orders/${id}`);
  return parseResponse(res);
};

export const cancelOrder = async (id) => {
  const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
    method: "PATCH",
  });

  return parseResponse(res);
};

export const loginAdmin = async (username, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  return parseResponse(res);
};

export const fetchMe = async () => {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const fetchOrders = async (params = {}) => {
  const res = await fetch(`${API_URL}/orders${buildQuery(params)}`, {
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const updateOrderStatus = async (id, status) => {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  });

  return parseResponse(res);
};

export const fetchDashboard = async () => {
  const res = await fetch(`${API_URL}/orders/dashboard/stats`, {
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const fetchWaiterCalls = async () => {
  const res = await fetch(`${API_URL}/waiter-calls`, {
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const createWaiterCall = async (tableNumber) => {
  const res = await fetch(`${API_URL}/waiter-calls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tableNumber }),
  });

  return parseResponse(res);
};

export const completeWaiterCall = async (id) => {
  const res = await fetch(`${API_URL}/waiter-calls/${id}/done`, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const createProduct = async (payload) => {
  const res = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
};

export const updateProduct = async (id, payload) => {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
};

export const deleteProduct = async (id) => {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });

  return parseResponse(res);
};

export const createPaymentSession = async (orderId) => {
  const res = await fetch(`${API_URL}/payments/create-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  return parseResponse(res);
};