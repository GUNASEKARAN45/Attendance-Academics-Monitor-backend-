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
      const rawSecret = process.env.JWT_SECRET || "";
      const trimmedSecret = rawSecret.trim();
      const normalizedSecret = (function (s) {
        const t = s.trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
          return t.slice(1, -1);
        }
        return t;
      })(rawSecret);

      if (!normalizedSecret) {
        return res.status(500).json({ error: "Server misconfiguration" });
      }

      let payload = null;
      const candidates = [rawSecret, trimmedSecret, normalizedSecret].filter(Boolean);
      let lastError = null;
      for (const secret of candidates) {
        try {
          payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
          break;
        } catch (err) {
          lastError = err;
          payload = null;
        }
      }
      if (!payload) {
        throw lastError || new Error("Invalid token");
      }
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
