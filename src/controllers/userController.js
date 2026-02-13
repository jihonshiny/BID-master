const userService = require("../services/userService");
const jwt = require("jsonwebtoken");

const userController = {
  // 회원가입
  signup: async (req, res, next) => {
    try {
      const { email, password, name, nickname } = req.body;

      // 필수 필드 검증
      if (!email || !password || !name) {
        return res.status(400).json({
          message: "이메일, 비밀번호, 이름은 필수입니다",
        });
      }

      const user = await userService.createUser({
        email,
        password,
        name,
        nickname,
      });

      res.status(201).json({
        message: "회원가입 성공",
        user,
      });
    } catch (err) {
      if (err.message.includes("이미 사용 중")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  },

  // 로그인
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          message: "이메일과 비밀번호를 입력해주세요",
        });
      }

      const user = await userService.login(email, password);

      // JWT 토큰 생성
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
        },
        process.env.JWT_SECRET || "default-secret-key",
        { expiresIn: "7d" }
      );

      res.json({
        message: "로그인 성공",
        token,
        user,
      });
    } catch (err) {
      if (err.message.includes("일치하지 않습니다")) {
        return res.status(401).json({ message: err.message });
      }
      next(err);
    }
  },

  // 내 정보 조회
  getMe: async (req, res, next) => {
    try {
      const userId = req.user.id;

      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      const points = await userService.getPoints(userId);

      res.json({
        ...user,
        points,
      });
    } catch (err) {
      next(err);
    }
  },

  // 포인트 조회
  getPoints: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const points = await userService.getPoints(userId);
      const history = await userService.getPointHistory(userId);

      res.json({
        total: points,
        history,
      });
    } catch (err) {
      next(err);
    }
  },

  // 포인트 충전 (테스트용)
  chargePoints: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || amount < 1000 || amount > 1000000) {
        return res.status(400).json({
          message: "충전 금액은 1,000원 ~ 1,000,000원 사이여야 합니다",
        });
      }

      const newTotal = await userService.addPoints(userId, amount, "포인트 충전");

      res.json({
        message: "충전 완료",
        amount,
        total: newTotal,
        newBalance: newTotal,
      });
    } catch (err) {
      next(err);
    }
  },

  // 내 입찰 목록 조회
  getMyBids: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const bids = await userService.getMyBids(userId);
      res.json({ bids });
    } catch (err) {
      next(err);
    }
  },

  // 내 경매 목록 조회
  getMyAuctions: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const auctions = await userService.getMyAuctions(userId);
      res.json({ auctions });
    } catch (err) {
      next(err);
    }
  },

  // 포인트 내역 조회
  getPointsHistory: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const history = await userService.getPointHistory(userId);
      res.json({ history });
    } catch (err) {
      next(err);
    }
  },

  // 내 찜 목록 조회
  getMyFavorites: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const favorites = await userService.getMyFavorites(userId);
      res.json({ favorites });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = userController;
