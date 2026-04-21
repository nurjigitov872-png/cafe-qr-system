import express from "express";
const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // 🔥 ENV менен текшерүү
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({
      success: true,
      message: "Login successful",
    });
  }

  return res.status(401).json({
    success: false,
    message: "Логин же пароль туура эмес",
  });
});

export default router;