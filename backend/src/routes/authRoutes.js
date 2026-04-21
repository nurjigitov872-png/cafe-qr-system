console.log("AUTH ROUTE LOADED");
const express = require("express");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  
  console.log("LOGIN DEBUG:", {
    inputUsername: username,
    inputPassword: password,
    envUsername: process.env.ADMIN_USERNAME,
    envPassword: process.env.ADMIN_PASSWORD,
    usernameMatch: username === process.env.ADMIN_USERNAME,
    passwordMatch: password === process.env.ADMIN_PASSWORD,
  });

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ message: "Логин же пароль ката" });
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