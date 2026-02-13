const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/auth");
const { validateBody, schemas } = require("../middlewares/validation");

// 회원가입
router.post("/signup", validateBody(schemas.signup), userController.signup);

// 로그인
router.post("/login", userController.login);

// 내 정보 조회 (인증 필요)
router.get("/me", verifyToken, userController.getMe);

// 포인트 조회 (인증 필요)
router.get("/points", verifyToken, userController.getPoints);

// 포인트 충전 - 테스트용 (인증 필요)
router.post("/points/charge", verifyToken, userController.chargePoints);

// 포인트 충전 - 다른 경로도 지원
router.post("/charge-points", verifyToken, userController.chargePoints);

// 내 입찰 목록 (인증 필요)
router.get("/my-bids", verifyToken, userController.getMyBids);

// 내 경매 목록 (인증 필요)
router.get("/my-auctions", verifyToken, userController.getMyAuctions);

// 포인트 내역 (인증 필요)
router.get("/points-history", verifyToken, userController.getPointsHistory);

// 내 찜 목록 (인증 필요)
router.get("/my-favorites", verifyToken, userController.getMyFavorites);

module.exports = router;
