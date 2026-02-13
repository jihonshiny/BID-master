const pool = require("../config/database");

const auctionService = {
  // 경매 등록
  createAuction: async (data) => {
    const {
      sellerId,
      title,
      description,
      category,
      startPrice,
      buyNowPrice,
      imageUrl,
      predictedPrice,
      duration,
    } = data;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    const sql = `
      INSERT INTO auction_items
      (seller_id, title, description, category, start_price, current_price,
       buy_now_price, image_url, ai_predicted_price, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '진행중')
    `;

    const [result] = await pool.query(sql, [
      sellerId,
      title,
      description,
      category,
      startPrice,
      startPrice,
      buyNowPrice || null,
      imageUrl,
      predictedPrice,
      startTime,
      endTime,
    ]);

    return result.insertId;
  },

  // 경매 목록 조회
  getAuctions: async (filters = {}) => {
    const { category, status, minPrice, maxPrice, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT a.*, u.name AS seller_name, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      JOIN users u ON a.seller_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (category) {
      sql += " AND a.category = ?";
      params.push(category);
    }

    if (status) {
      sql += " AND a.status = ?";
      params.push(status);
    }

    // 가격 범위 필터 추가
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      sql += " AND a.current_price >= ?";
      params.push(Number(minPrice));
    }

    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      sql += " AND a.current_price <= ?";
      params.push(Number(maxPrice));
    }

    sql += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  // 경매 상세 조회
  getAuctionById: async (auctionId) => {
    // 조회수 증가
    await pool.query(
      "UPDATE auction_items SET view_count = view_count + 1 WHERE id = ?",
      [auctionId]
    );

    const sql = `
      SELECT a.*, u.name AS seller_name, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             (SELECT COUNT(DISTINCT user_id) FROM bids WHERE auction_id = a.id) AS bidder_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      JOIN users u ON a.seller_id = u.id
      WHERE a.id = ?
    `;

    const [rows] = await pool.query(sql, [auctionId]);
    return rows[0];
  },

  // 입찰 내역 조회
  getBidHistory: async (auctionId, limit = 20) => {
    const sql = `
      SELECT b.id, b.bid_price, b.bid_time, b.is_auto_bid,
             u.nickname, u.id AS user_id
      FROM bids b
      JOIN users u ON b.user_id = u.id
      WHERE b.auction_id = ?
      ORDER BY b.bid_time DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [auctionId, limit]);
    return rows;
  },

  // 경매 수정
  updateAuction: async (auctionId, sellerId, data) => {
    const { title, description, category, image_url, buyNowPrice } = data;

    // 본인 경매인지 확인 (진행중이어도 수정 가능하도록 변경)
    const [auction] = await pool.query(
      "SELECT * FROM auction_items WHERE id = ? AND seller_id = ?",
      [auctionId, sellerId]
    );

    if (!auction[0]) {
      throw new Error("권한이 없습니다");
    }

    // 동적으로 업데이트할 필드 구성
    const updates = [];
    const params = [];

    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (category) {
      updates.push("category = ?");
      params.push(category);
    }
    if (image_url) {
      updates.push("image_url = ?");
      params.push(image_url);
    }
    if (buyNowPrice !== undefined) {
      updates.push("buy_now_price = ?");
      params.push(buyNowPrice);
    }

    if (updates.length === 0) {
      return true; // 업데이트할 내용 없음
    }

    params.push(auctionId);
    const sql = `UPDATE auction_items SET ${updates.join(", ")} WHERE id = ?`;

    await pool.query(sql, params);
    return true;
  },

  // 경매 삭제
  deleteAuction: async (auctionId, sellerId) => {
    // 본인 경매인지 확인
    const [auction] = await pool.query(
      "SELECT status FROM auction_items WHERE id = ? AND seller_id = ?",
      [auctionId, sellerId]
    );

    if (!auction[0]) {
      throw new Error("권한이 없습니다");
    }

    if (auction[0].status === "진행중") {
      // 입찰자가 있는지 확인
      const [bids] = await pool.query(
        "SELECT COUNT(*) AS count FROM bids WHERE auction_id = ?",
        [auctionId]
      );

      if (bids[0].count > 0) {
        throw new Error("입찰자가 있는 경매는 삭제할 수 없습니다");
      }
    }

    await pool.query("DELETE FROM auction_items WHERE id = ?", [auctionId]);
    return true;
  },

  // 카테고리 목록
  getCategories: async () => {
    const [rows] = await pool.query(
      "SELECT DISTINCT category FROM auction_items WHERE category IS NOT NULL ORDER BY category"
    );
    return rows.map((row) => row.category);
  },

  // 인기 경매 (입찰 많은 순)
  getPopularAuctions: async (limit = 5) => {
    const sql = `
      SELECT a.*, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      JOIN users u ON a.seller_id = u.id
      WHERE a.status = '진행중'
      ORDER BY bid_count DESC, a.view_count DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [limit]);
    return rows;
  },

  // 마감 임박 경매
  getEndingSoonAuctions: async (limit = 5) => {
    const sql = `
      SELECT a.*, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      JOIN users u ON a.seller_id = u.id
      WHERE a.status = '진행중' AND a.end_time > NOW()
      ORDER BY a.end_time ASC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [limit]);
    return rows;
  },

  // 내가 등록한 경매
  getMyAuctions: async (userId) => {
    const sql = `
      SELECT a.*,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      WHERE a.seller_id = ?
      ORDER BY a.created_at DESC
    `;

    const [rows] = await pool.query(sql, [userId]);
    return rows;
  },

  // 검색
  searchAuctions: async (keyword) => {
    const sql = `
      SELECT a.*, u.nickname AS seller_nickname,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) AS bid_count,
             TIMESTAMPDIFF(SECOND, NOW(), a.end_time) AS remaining_seconds
      FROM auction_items a
      JOIN users u ON a.seller_id = u.id
      WHERE a.status = '진행중'
        AND (a.title LIKE ? OR a.description LIKE ? OR a.category LIKE ?)
      ORDER BY a.created_at DESC
    `;

    const searchTerm = `%${keyword}%`;
    const [rows] = await pool.query(sql, [searchTerm, searchTerm, searchTerm]);
    return rows;
  },

  // 즉시 구매
  buyNow: async (auctionId, buyerId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 경매 정보 조회 (FOR UPDATE)
      const [auction] = await connection.query(
        `SELECT * FROM auction_items WHERE id = ? AND status = '진행중' FOR UPDATE`,
        [auctionId]
      );

      if (!auction[0]) {
        throw new Error("경매를 찾을 수 없거나 이미 종료되었습니다");
      }

      if (!auction[0].buy_now_price) {
        throw new Error("즉시구매가 설정되지 않은 경매입니다");
      }

      if (auction[0].seller_id === buyerId) {
        throw new Error("본인 경매는 구매할 수 없습니다");
      }

      const buyNowPrice = auction[0].buy_now_price;

      // 포인트 확인
      const [points] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM points WHERE user_id = ?",
        [buyerId]
      );

      if (points[0].total < buyNowPrice) {
        throw new Error("포인트가 부족합니다");
      }

      // 경매 종료 처리
      await connection.query(
        `UPDATE auction_items
         SET status = '종료', winner_id = ?, current_price = ?
         WHERE id = ?`,
        [buyerId, buyNowPrice, auctionId]
      );

      // 거래 내역 생성
      await connection.query(
        `INSERT INTO auction_transactions
         (auction_id, seller_id, buyer_id, final_price, transaction_status)
         VALUES (?, ?, ?, ?, '결제대기')`,
        [auctionId, auction[0].seller_id, buyerId, buyNowPrice]
      );

      // 구매자 포인트 차감
      await connection.query(
        "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
        [buyerId, -buyNowPrice, `즉시구매: ${auction[0].title}`]
      );

      // 판매자 포인트 지급 (수수료 10% 제외)
      const sellerAmount = Math.floor(buyNowPrice * 0.9);
      await connection.query(
        "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
        [auction[0].seller_id, sellerAmount, `경매 판매: ${auction[0].title}`]
      );

      await connection.commit();
      return { success: true, finalPrice: buyNowPrice };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = auctionService;
