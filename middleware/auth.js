const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = (roles = []) => {
  // roles can be a string or array
  if (typeof roles === "string") roles = [roles];
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing token" });
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // { userId, role }
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};

module.exports = authMiddleware;
