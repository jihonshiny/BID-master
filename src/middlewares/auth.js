const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }

  const token = authHeader.split(" ")[1];

  // 데모 토큰 처리
  if (token === "demo-token-12345") {
    req.user = {
      id: 1,
      name: "테스트유저",
      nickname: "입찰왕",
      email: "demo@test.com"
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
};

// 선택적 인증 (토큰 있으면 사용, 없어도 통과)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  // 데모 토큰 처리
  if (token === "demo-token-12345") {
    req.user = {
      id: 1,
      name: "테스트유저",
      nickname: "입찰왕",
      email: "demo@test.com"
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // 토큰이 유효하지 않아도 통과
  }
  next();
};

module.exports = { verifyToken, optionalAuth };
