const express = require("express");
const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.status(200).json({
      success: true,
      message: "Login successful",
      username,
    });
  }

  return res.status(401).json({
    success: false,
    message: "Логин же пароль туура эмес",
  });
});

module.exports = router;