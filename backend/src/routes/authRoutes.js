const express = require("express");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  const envUsername = String(process.env.ADMIN_USERNAME || "").trim();
  const envPassword = String(process.env.ADMIN_PASSWORD || "").trim();

  console.log("LOGIN DEBUG:", {
    enteredUsername: username,
    enteredPasswordLength: password.length,
    envUsername,
    envPasswordLength: envPassword.length,
    usernameMatch: username === envUsername,
    passwordMatch: password === envPassword,
  });

  if (username !== envUsername || password !== envPassword) {
    return res.status(401).json({
      message: "Логин же пароль ката",
      debug: {
        usernameMatch: username === envUsername,
        passwordMatch: password === envPassword,
        enteredPasswordLength: password.length,
        envPasswordLength: envPassword.length,
      },
    });
  }

  const token = jwt.sign({ username }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ token, admin: { username } });
});

router.get("/me", auth, async (req, res) => {
  res.json({ username: req.admin.username });
});

module.exports = router;