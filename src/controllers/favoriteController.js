const favoriteService = require("../services/favoriteService");

const favoriteController = {
  // 찜 추가
  addFavorite: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { auction_id } = req.body;

      await favoriteService.addFavorite(userId, auction_id);

      res.status(201).json({ message: "찜 추가 완료" });
    } catch (err) {
      next(err);
    }
  },

  // 찜 제거
  removeFavorite: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { auction_id } = req.params;

      await favoriteService.removeFavorite(userId, auction_id);

      res.json({ message: "찜 제거 완료" });
    } catch (err) {
      next(err);
    }
  },

  // 내 찜 목록
  getMyFavorites: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const favorites = await favoriteService.getMyFavorites(userId);

      res.json({
        count: favorites.length,
        favorites,
      });
    } catch (err) {
      next(err);
    }
  },

  // 찜 여부 확인
  checkFavorite: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { auction_id } = req.params;

      const isFavorited = await favoriteService.isFavorited(userId, auction_id);

      res.json({ isFavorited });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = favoriteController;
