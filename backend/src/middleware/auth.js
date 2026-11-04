const jwt = require("jsonwebtoken");

const issuer = "cafe-qr-backend";
const audience = "cafe-qr-api";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) throw new Error("JWT configuration missing");
  return secret;
};

const signToken = (claims, subject) => jwt.sign(claims, getSecret(), {
  algorithm: "HS256", issuer, audience, subject: String(subject), expiresIn: "7d",
});

const verifyToken = (token) => {
  const claims = jwt.verify(token, getSecret(), { algorithms: ["HS256"], issuer, audience });
  if (!claims || typeof claims !== "object" || !Number.isFinite(claims.exp) || !claims.sub) {
    throw new Error("Invalid token claims");
  }
  return claims;
};

const isAdmin = (claims) => claims.role === "admin" &&
  claims.sub === String(process.env.ADMIN_USERNAME || "").trim();

const authenticate = (req, res, next) => {
  if (!process.env.JWT_SECRET?.trim()) {
    return res.status(503).json({ message: "Authentication is not configured" });
  }
  const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") || "");
  if (!match) return res.status(401).set("WWW-Authenticate", "Bearer").json({ message: "Authentication required" });
  try {
    req.auth = verifyToken(match[1]);
  } catch {
    return res.status(401).set("WWW-Authenticate", "Bearer").json({ message: "Invalid or expired token" });
  }
  return next();
};

const requireAdmin = (req, res, next) => authenticate(req, res, () => {
  if (!isAdmin(req.auth)) return res.status(403).json({ message: "Admin access required" });
  return next();
});

// Customer tokens authorize only the order that was just created.
const requireOrderAccess = (req, res, next) => authenticate(req, res, () => {
  if (isAdmin(req.auth) || (req.auth.role === "customer" && req.auth.sub === req.params.id)) {
    return next();
  }
  return res.status(403).json({ message: "Access to this order denied" });
});

const authenticateAdminSocket = (socket, next) => {
  try {
    const claims = verifyToken(socket.handshake.auth?.token);
    if (!isAdmin(claims)) throw new Error("Admin access required");
    socket.data.auth = claims;
    return next();
  } catch {
    return next(new Error("Admin authentication required"));
  }
};

module.exports = { signToken, verifyToken, requireAdmin, requireOrderAccess, authenticateAdminSocket, getSecret };
