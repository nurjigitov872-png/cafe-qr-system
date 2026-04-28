const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  const envUser = String(process.env.ADMIN_USERNAME || "").trim();
  const envPass = String(process.env.ADMIN_PASSWORD || "").trim();

  if (username === envUser && password === envPass) {
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      admin: { username },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Логин же пароль туура эмес",
  });
});

module.exports = router;