import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "https://cafe-backend-weo1.onrender.com";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (callback) => callback({ token: localStorage.getItem("admin_token") }),
  transports: ["websocket", "polling"],
});

export default socket;