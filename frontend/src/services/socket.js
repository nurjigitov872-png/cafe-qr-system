import { io } from "socket.io-client";

import { SOCKET as SOCKET_URL } from "../config/connections.js";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (callback) => callback({ token: localStorage.getItem("admin_token") }),
  transports: ["websocket", "polling"],
});

export default socket;