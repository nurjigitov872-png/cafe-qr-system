const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { checkTelegramConfig } = require("./utils/telegram");
checkTelegramConfig();

// Optional process-local DNS for Atlas SRV lookups; does not change Windows DNS.
const mongoDnsServers = String(process.env.MONGO_DNS_SERVERS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (mongoDnsServers.length) {
  try {
    require("node:dns").setServers(mongoDnsServers);
  } catch {
    console.error("MongoDB configuration error: invalid MONGO_DNS_SERVERS.");
    process.exit(1);
  }
}


const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const waiterCallRoutes = require("./routes/waiterCallRoutes");

const { getSecret } = require("./middleware/auth");
try { getSecret(); } catch {
  console.error("JWT_SECRET is required; backend startup refused.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

const { socketAuth, connectSocket } = require("./utils/notificationPolicy");
const { createNotifications } = require("./utils/notifications");
io.use(socketAuth);
app.set("notifications", createNotifications(io));
app.set("io", io);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Cafe QR backend is running",
  });
});

app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/waiter-calls", waiterCallRoutes);

io.on("connection", connectSocket);

const PORT = process.env.PORT || 10000;

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log("MongoDB connected");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    // Raw driver errors may contain connection details. Log fixed guidance only.
    const dnsFailure = ["querySrv", "queryTxt"].includes(err.syscall);
    const authFailure = err.code === 18;
    console.error(
      "MongoDB connection failed:",
      dnsFailure
        ? "DNS lookup failed. Check MONGO_DNS_SERVERS and the Atlas hostname."
        : authFailure
          ? "Authentication failed. Check database credentials privately."
          : "Check database availability, network access, and Atlas IP Access List."
    );
    process.exit(1);
  });