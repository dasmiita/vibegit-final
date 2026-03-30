const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "vibegit_secret";

/** Sets req.user when a valid Bearer token is present; otherwise continues without auth. */
module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    // ignore invalid/expired token for public routes
  }
  next();
};
