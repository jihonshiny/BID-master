const auctionService = require("../services/auctionService");
const aiService = require("../services/aiService");
const fs = require('fs');
const path = require('path');

const auctionController = {
  // 경매 등록
  createAuction: async (req, res, next) => {
    try {
      const { title, description, category, start_price, buy_now_price, duration } = req.body;
      const sellerId = req.user.id;

      // 유효성 검사
      if (!title || title.length < 2) {
        return res.status(400).json({ message: "제목을 2자 이상 입력해주세요" });
      }

      const startPrice = parseInt(start_price);
      if (!startPrice || startPrice < 1000) {
        return res.status(400).json({ message: "시작가는 1,000원 이상이어야 합니다" });
      }

      // 이미지 저장 (Base64로 DB에 저장 - 배포 환경 호환)
      let imageUrl = null;
      if (req.file) {
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';
        imageUrl = `data:${mimeType};base64,${base64}`;
      }

      // AI로 적정가 예측
      let predictedPrice = null;
      try {
        predictedPrice = await aiService.predictPrice(
          title,
          description,
          category,
          startPrice
        );
      } catch (aiError) {
        console.log("AI 가격 예측 실패:", aiError.message);
        predictedPrice = Math.floor(startPrice * 1.2);
      }

      const auctionId = await auctionService.createAuction({
        sellerId,
        title,
        description,
        category,
        startPrice: startPrice,
        buyNowPrice: buy_now_price ? parseInt(buy_now_price) : null,
        imageUrl,
        predictedPrice,
        duration: parseInt(duration) || 24,
      });

      res.status(201).json({
        message: "경매 등록 완료",
        auctionId,
        predictedPrice,
      });
    } catch (err) {
      next(err);
    }
  },

  // 경매 목록 조회
  getAuctions: async (req, res, next) => {
    try {
      const { category, status, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

      const auctions = await auctionService.getAuctions({
        category,
        status,
        minPrice,
        maxPrice,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        count: auctions.length,
        auctions,
      });
    } catch (err) {
      next(err);
    }
  },

  // 경매 상세 조회
  getAuctionDetail: async (req, res, next) => {
    try {
      const { id } = req.params;
      const auction = await auctionService.getAuctionById(id);

      if (!auction) {
        return res.status(404).json({ message: "경매를 찾을 수 없습니다" });
      }

      // 입찰 내역도 함께 조회
      const bidHistory = await auctionService.getBidHistory(id, 10);

      res.json({
        ...auction,
        bidHistory,
      });
    } catch (err) {
      next(err);
    }
  },

  // 경매 수정
  updateAuction: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { title, description, category, image_url } = req.body;

      // 이미지 파일 업로드 처리 (Base64로 DB에 저장)
      let imageUrl = image_url;
      if (req.file) {
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';
        imageUrl = `data:${mimeType};base64,${base64}`;
      }

      await auctionService.updateAuction(id, userId, {
        title,
        description,
        category,
        image_url: imageUrl
      });

      res.json({ message: "경매 수정 완료", image_url: imageUrl });
    } catch (err) {
      next(err);
    }
  },

  // 경매 삭제
  deleteAuction: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await auctionService.deleteAuction(id, userId);

      res.json({ message: "경매 삭제 완료" });
    } catch (err) {
      next(err);
    }
  },

  // 카테고리 목록
  getCategories: async (req, res, next) => {
    try {
      const categories = await auctionService.getCategories();
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },

  // 인기 경매
  getPopularAuctions: async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const auctions = await auctionService.getPopularAuctions(limit);
      res.json(auctions);
    } catch (err) {
      next(err);
    }
  },

  // 마감 임박 경매
  getEndingSoonAuctions: async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const auctions = await auctionService.getEndingSoonAuctions(limit);
      res.json(auctions);
    } catch (err) {
      next(err);
    }
  },

  // 내가 등록한 경매
  getMyAuctions: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const auctions = await auctionService.getMyAuctions(userId);
      res.json(auctions);
    } catch (err) {
      next(err);
    }
  },

  // 경매 검색
  searchAuctions: async (req, res, next) => {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({ message: "검색어를 2자 이상 입력해주세요" });
      }

      const auctions = await auctionService.searchAuctions(q);

      res.json({
        count: auctions.length,
        auctions,
      });
    } catch (err) {
      next(err);
    }
  },

  // 즉시 구매
  buyNow: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await auctionService.buyNow(id, userId);

      // Socket.io로 경매 종료 알림
      const io = req.app.get("io");
      io.to(`auction_${id}`).emit("auction_ended", {
        auctionId: id,
        winnerId: userId,
        finalPrice: result.finalPrice,
        reason: "즉시구매",
      });

      res.json({
        message: "즉시구매 완료",
        finalPrice: result.finalPrice,
      });
    } catch (err) {
      next(err);
    }
  },

  // AI 입찰 전략 추천
  getBidStrategy: async (req, res, next) => {
    try {
      const { id } = req.params;

      const auction = await auctionService.getAuctionById(id);
      if (!auction) {
        return res.status(404).json({ message: "경매를 찾을 수 없습니다" });
      }

      const bidHistory = await auctionService.getBidHistory(id, 10);

      let strategy;
      try {
        strategy = await aiService.recommendBidStrategy(
          id,
          auction.current_price,
          bidHistory
        );
      } catch (aiError) {
        console.log("AI 전략 추천 실패:", aiError.message);
        // AI 실패시 기본 전략 반환
        strategy = {
          strategy: "안정적",
          recommended_price: auction.current_price + 1000,
          tip: "현재가보다 조금 높게 입찰하세요."
        };
      }

      res.json(strategy);
    } catch (err) {
      next(err);
    }
  },

  // AI 이미지 분석
  analyzeImage: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "이미지 파일이 필요합니다"
        });
      }

      // 이미지를 base64로 변환
      const base64Image = req.file.buffer.toString('base64');

      let analysis;
      try {
        // AI 분석 요청
        analysis = await aiService.analyzeProductImage(base64Image);
      } catch (aiError) {
        console.log("AI 이미지 분석 실패:", aiError.message);
        // AI 실패시 기본값 반환
        analysis = {
          title: "",
          category: "기타",
          condition: "중",
          price_min: 10000,
          price_max: 50000,
          description: "AI 서버에 연결할 수 없습니다. 직접 정보를 입력해주세요."
        };
      }

      res.json({
        success: true,
        analysis
      });
    } catch (err) {
      console.error('이미지 분석 오류:', err);
      next(err);
    }
  },
};

module.exports = auctionController;
