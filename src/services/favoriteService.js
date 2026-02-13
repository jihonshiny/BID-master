const pool = require("../config/database");

const favoriteService = {
  // 찜 추가
  addFavorite: async (userId, auctionId) => {
    // 경매 존재 확인
    const [auction] = await pool.query(
      "SELECT id FROM auction_items WHERE id = ?",
      [auctionId]
    );

    if (!auction[0]) {
      throw new Error("경매를 찾을 수 없습니다");
    }

    try {
      await pool.query(
        "INSERT INTO auction_favorites (user_id, auction_id) VALUES (?, ?)",
        [userId, auctionId]
      );
      return { success: true };
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        throw new Error("이미 찜한 경매입니다");
      }
      throw err;
    }
  },

  // 찜 제거
  removeFavorite: async (userId, auctionId) => {
    const [result] = await pool.query(
      "DELETE FROM auction_favorites WHERE user_id = ? AND auction_id = ?",
      [userId, auctionId]
    );

    if (result.affectedRows === 0) {
      throw new Error("찜 목록에 없는 경매입니다");
    }

    return { success: true };
  },

  // 내 찜 목록
  getMyFavorites: async (userId) => {
    const sql = `
      SELECT f.id AS favorite_id, f.created_at AS favorited_at,
             a.*, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_favorites f
      JOIN auction_items a ON f.auction_id = a.id
      JOIN users u ON a.seller_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `;

    const [rows] = await pool.query(sql, [userId]);
    return rows;
  },

  // 찜 여부 확인
  isFavorited: async (userId, auctionId) => {
    const [rows] = await pool.query(
      "SELECT id FROM auction_favorites WHERE user_id = ? AND auction_id = ?",
      [userId, auctionId]
    );
    return rows.length > 0;
  },

  // 경매의 찜 개수
  getFavoriteCount: async (auctionId) => {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM auction_favorites WHERE auction_id = ?",
      [auctionId]
    );
    return rows[0].count;
  },
};

module.exports = favoriteService;
