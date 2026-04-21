const express = require("express");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

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