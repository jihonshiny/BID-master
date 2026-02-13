const express = require("express");
const router = express.Router();
const auctionController = require("../controllers/auctionController");
const bidController = require("../controllers/bidController");
const favoriteController = require("../controllers/favoriteController");
const { verifyToken } = require("../middlewares/auth");
const { validateBody, schemas } = require("../middlewares/validation");
const upload = require("../middlewares/upload");

// ============================================
// 정적 경로 (먼저 정의해야 함!)
// ============================================

// 경매 목록/검색 (인증 불필요)
router.get("/", auctionController.getAuctions);
router.get("/search", auctionController.searchAuctions);
router.get("/categories", auctionController.getCategories);
router.get("/popular", auctionController.getPopularAuctions);
router.get("/ending-soon", auctionController.getEndingSoonAuctions);

// 내 경매 목록 (인증 필요) - /:id 보다 먼저!
router.get("/my/auctions", verifyToken, auctionController.getMyAuctions);

// 입찰 관련 정적 경로 (인증 필요)
router.post(
  "/bid",
  verifyToken,
  validateBody(schemas.placeBid),
  bidController.placeBid
);
router.get("/bid/my", verifyToken, bidController.getMyBids);

// 자동 입찰 정적 경로
router.post(
  "/auto-bid",
  verifyToken,
  validateBody(schemas.setAutoBid),
  bidController.setAutoBid
);
router.get("/auto-bid/my", verifyToken, bidController.getMyAutoBids);

// 찜 관련 정적 경로 (인증 필요)
router.post("/favorite", verifyToken, favoriteController.addFavorite);
router.get("/favorite/my", verifyToken, favoriteController.getMyFavorites);

// AI 이미지 분석 (인증 필요)
router.post(
  "/analyze-image",
  verifyToken,
  upload.single("image"),
  auctionController.analyzeImage
);

// ============================================
// 경매 등록 (인증 필요) - 이미지 업로드 포함
// ============================================
router.post(
  "/",
  verifyToken,
  upload.single("image"),
  auctionController.createAuction
);

// ============================================
// 동적 경로 (마지막에 정의!)
// ============================================

// 경매 상세 조회 (인증 불필요)
router.get("/:id", auctionController.getAuctionDetail);

// 경매 입찰 내역 조회
router.get("/:id/bids", bidController.getBidHistory);

// AI 입찰 전략 추천 (인증 필요)
router.get("/:id/strategy", verifyToken, auctionController.getBidStrategy);

// 즉시 구매 (인증 필요)
router.post("/:id/buy-now", verifyToken, auctionController.buyNow);

// 경매 수정/삭제 (인증 필요)
router.put("/:id", verifyToken, upload.single("image"), auctionController.updateAuction);
router.delete("/:id", verifyToken, auctionController.deleteAuction);

// 내 입찰 내역 (특정 경매)
router.get("/bid/my/:auction_id", verifyToken, bidController.getMyBidsForAuction);

// 자동 입찰 취소
router.delete("/auto-bid/:auction_id", verifyToken, bidController.cancelAutoBid);

// 찜 관련 동적 경로
router.delete("/favorite/:auction_id", verifyToken, favoriteController.removeFavorite);
router.get("/favorite/check/:auction_id", verifyToken, favoriteController.checkFavorite);

module.exports = router;
