const express = require("express");
const { signToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();

  const envUser = String(process.env.ADMIN_USERNAME || "").trim();
  const envPass = String(process.env.ADMIN_PASSWORD || "").trim();

  if (!envUser || !envPass || !process.env.JWT_SECRET?.trim()) {
    return res.status(503).json({ message: "Authentication is not configured" });
  }

  if (username === envUser && password === envPass) {
    const token = signToken({ role: "admin" }, username);

    return res.json({
      success: true,
      token,
      admin: { username, role: "admin" },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Логин же пароль туура эмес",
  });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ admin: { username: req.auth.sub, role: "admin" } });
});

module.exports = router;