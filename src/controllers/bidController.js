const bidService = require("../services/bidService");
const auctionService = require("../services/auctionService");

const bidController = {
  // 입찰하기 (HTTP)
  placeBid: async (req, res, next) => {
    try {
      const { auction_id, bid_price } = req.body;
      const userId = req.user.id;

      const result = await bidService.placeBid(userId, auction_id, bid_price);

      // Socket.io로 입찰 브로드캐스트
      const io = req.app.get("io");
      io.to(`auction_${auction_id}`).emit("new_bid", {
        userId,
        nickname: req.user.nickname,
        bidPrice: bid_price,
        bidTime: new Date(),
      });

      io.to(`auction_${auction_id}`).emit("price_update", {
        currentPrice: result.currentPrice,
      });

      res.json({
        message: "입찰 성공!",
        currentPrice: result.currentPrice,
      });
    } catch (err) {
      next(err);
    }
  },

  // 내 입찰 내역
  getMyBids: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const bids = await bidService.getMyBids(userId);

      res.json({
        count: bids.length,
        bids,
      });
    } catch (err) {
      next(err);
    }
  },

  // 특정 경매의 내 입찰 내역
  getMyBidsForAuction: async (req, res, next) => {
    try {
      const { auction_id } = req.params;
      const userId = req.user.id;

      const bids = await bidService.getMyBidsForAuction(userId, auction_id);

      res.json(bids);
    } catch (err) {
      next(err);
    }
  },

  // 자동 입찰 설정
  setAutoBid: async (req, res, next) => {
    try {
      const { auction_id, max_price } = req.body;
      const userId = req.user.id;

      await bidService.setAutoBid(userId, auction_id, max_price);

      res.json({
        message: "자동 입찰 설정 완료",
        maxPrice: max_price,
      });
    } catch (err) {
      next(err);
    }
  },

  // 자동 입찰 취소
  cancelAutoBid: async (req, res, next) => {
    try {
      const { auction_id } = req.params;
      const userId = req.user.id;

      await bidService.cancelAutoBid(userId, auction_id);

      res.json({ message: "자동 입찰 취소 완료" });
    } catch (err) {
      next(err);
    }
  },

  // 내 자동 입찰 목록
  getMyAutoBids: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const autoBids = await bidService.getMyAutoBids(userId);

      res.json(autoBids);
    } catch (err) {
      next(err);
    }
  },

  // 경매 입찰 내역 조회
  getBidHistory: async (req, res, next) => {
    try {
      const auctionId = req.params.id || req.params.auction_id;
      const limit = parseInt(req.query.limit) || 20;

      const bids = await auctionService.getBidHistory(auctionId, limit);

      res.json({
        count: bids.length,
        bids,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = bidController;
