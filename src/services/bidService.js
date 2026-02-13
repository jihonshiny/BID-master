const pool = require("../config/database");

const bidService = {
  // 입찰하기
  placeBid: async (userId, auctionId, bidPrice) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 경매 정보 조회 (FOR UPDATE로 락)
      const [auction] = await connection.query(
        `SELECT current_price, end_time, status, seller_id, title
         FROM auction_items
         WHERE id = ? FOR UPDATE`,
        [auctionId]
      );

      if (!auction[0]) {
        throw new Error("경매를 찾을 수 없습니다");
      }

      if (auction[0].status !== "진행중") {
        throw new Error("진행중인 경매가 아닙니다");
      }

      if (new Date() > new Date(auction[0].end_time)) {
        throw new Error("경매가 종료되었습니다");
      }

      if (auction[0].seller_id === userId) {
        throw new Error("자신의 경매에는 입찰할 수 없습니다");
      }

      if (bidPrice <= auction[0].current_price) {
        throw new Error(`현재가(${auction[0].current_price.toLocaleString()}원)보다 높은 금액을 입찰해주세요`);
      }

      // 2. 사용자 포인트 확인 (단순화: 총 포인트만 확인)
      const [points] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM points WHERE user_id = ?",
        [userId]
      );

      const totalPoints = Number(points[0].total) || 0;

      console.log(`[입찰] 사용자 ${userId}, 보유포인트: ${totalPoints}, 입찰가: ${bidPrice}`);

      if (totalPoints < bidPrice) {
        throw new Error(`포인트가 부족합니다. (보유: ${totalPoints.toLocaleString()}원, 필요: ${bidPrice.toLocaleString()}원)`);
      }

      // 3. 이전 최고 입찰자 정보 (알림용)
      const [prevHighestBid] = await connection.query(
        `SELECT user_id FROM bids
         WHERE auction_id = ?
         ORDER BY bid_price DESC LIMIT 1`,
        [auctionId]
      );

      // 4. 이전 내 입찰금액 확인 (차액만 차감하기 위해)
      const [myPrevBid] = await connection.query(
        `SELECT COALESCE(MAX(bid_price), 0) as prev_bid FROM bids
         WHERE auction_id = ? AND user_id = ?`,
        [auctionId, userId]
      );
      const prevMyBid = Number(myPrevBid[0].prev_bid) || 0;
      const pointsToDeduct = bidPrice - prevMyBid; // 차액만 차감

      // 5. 포인트 차감 (차액만)
      if (pointsToDeduct > 0) {
        await connection.query(
          `INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)`,
          [userId, -pointsToDeduct, `입찰: ${auction[0].title}`]
        );
        console.log(`[입찰] 포인트 차감: ${pointsToDeduct}원 (이전입찰: ${prevMyBid}, 새입찰: ${bidPrice})`);
      }

      // 6. 입찰 기록 저장
      await connection.query(
        "INSERT INTO bids (auction_id, user_id, bid_price) VALUES (?, ?, ?)",
        [auctionId, userId, bidPrice]
      );

      // 7. 현재가 업데이트
      await connection.query(
        "UPDATE auction_items SET current_price = ? WHERE id = ?",
        [bidPrice, auctionId]
      );

      // 8. 이전 최고 입찰자에게 알림 (본인이 아닌 경우)
      if (prevHighestBid[0] && prevHighestBid[0].user_id !== userId) {
        await connection.query(
          `INSERT INTO auction_notifications
           (user_id, auction_id, type, message)
           VALUES (?, ?, 'outbid', ?)`,
          [
            prevHighestBid[0].user_id,
            auctionId,
            `${auction[0].title} 경매에서 더 높은 입찰이 들어왔습니다. 현재가: ${bidPrice.toLocaleString()}원`,
          ]
        );
      }

      // 9. 자동 입찰 체크
      await processAutoBids(connection, auctionId, bidPrice, userId);

      await connection.commit();
      return { success: true, currentPrice: bidPrice };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // 내 입찰 내역 (경매별 최고 입찰만)
  getMyBids: async (userId) => {
    const sql = `
      SELECT
        b.id, b.user_id, b.auction_id, b.bid_price, b.bid_time,
        a.title, a.status, a.end_time, a.current_price,
        a.image_url, a.winner_id,
        a.current_price AS highest_bid,
        CASE WHEN a.winner_id = ? THEN 1 ELSE 0 END AS is_winner
      FROM bids b
      JOIN auction_items a ON b.auction_id = a.id
      WHERE b.user_id = ?
        AND b.bid_price = (
          SELECT MAX(b2.bid_price)
          FROM bids b2
          WHERE b2.auction_id = b.auction_id AND b2.user_id = ?
        )
      ORDER BY b.bid_time DESC
    `;

    const [rows] = await pool.query(sql, [userId, userId, userId]);
    return rows;
  },

  // 특정 경매의 내 입찰 내역
  getMyBidsForAuction: async (userId, auctionId) => {
    const sql = `
      SELECT * FROM bids
      WHERE user_id = ? AND auction_id = ?
      ORDER BY bid_time DESC
    `;

    const [rows] = await pool.query(sql, [userId, auctionId]);
    return rows;
  },

  // 자동 입찰 설정
  setAutoBid: async (userId, auctionId, maxPrice) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 경매 확인
      const [auction] = await connection.query(
        "SELECT current_price, status, seller_id FROM auction_items WHERE id = ?",
        [auctionId]
      );

      if (!auction[0] || auction[0].status !== "진행중") {
        throw new Error("유효하지 않은 경매입니다");
      }

      if (auction[0].seller_id === userId) {
        throw new Error("본인 경매에는 자동 입찰을 설정할 수 없습니다");
      }

      if (maxPrice <= auction[0].current_price) {
        throw new Error("현재가보다 높은 금액을 설정해주세요");
      }

      // 포인트 확인
      const [points] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM points WHERE user_id = ?",
        [userId]
      );

      if (points[0].total < maxPrice) {
        throw new Error("포인트가 부족합니다");
      }

      // 기존 자동 입찰 비활성화
      await connection.query(
        "UPDATE auto_bids SET active = FALSE WHERE user_id = ? AND auction_id = ?",
        [userId, auctionId]
      );

      // 새 자동 입찰 등록
      await connection.query(
        "INSERT INTO auto_bids (user_id, auction_id, max_price) VALUES (?, ?, ?)",
        [userId, auctionId, maxPrice]
      );

      await connection.commit();
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // 자동 입찰 취소
  cancelAutoBid: async (userId, auctionId) => {
    await pool.query(
      "UPDATE auto_bids SET active = FALSE WHERE user_id = ? AND auction_id = ?",
      [userId, auctionId]
    );
    return { success: true };
  },

  // 내 자동 입찰 목록
  getMyAutoBids: async (userId) => {
    const sql = `
      SELECT ab.*, a.title, a.current_price, a.status, a.end_time
      FROM auto_bids ab
      JOIN auction_items a ON ab.auction_id = a.id
      WHERE ab.user_id = ? AND ab.active = TRUE
      ORDER BY ab.created_at DESC
    `;

    const [rows] = await pool.query(sql, [userId]);
    return rows;
  },
};

// 자동 입찰 처리 (내부 함수)
const processAutoBids = async (connection, auctionId, currentBidPrice, currentBidderId) => {
  // 현재 입찰자를 제외한 활성 자동 입찰 조회
  const [autoBids] = await connection.query(
    `SELECT ab.*, u.nickname
     FROM auto_bids ab
     JOIN users u ON ab.user_id = u.id
     WHERE ab.auction_id = ?
       AND ab.active = TRUE
       AND ab.user_id != ?
       AND ab.max_price > ?
     ORDER BY ab.max_price DESC
     LIMIT 1`,
    [auctionId, currentBidderId, currentBidPrice]
  );

  if (autoBids.length > 0) {
    const autoBid = autoBids[0];
    const newBidPrice = Math.min(currentBidPrice + 1000, autoBid.max_price);

    // 자동 입찰 실행
    await connection.query(
      "INSERT INTO bids (auction_id, user_id, bid_price, is_auto_bid) VALUES (?, ?, ?, TRUE)",
      [auctionId, autoBid.user_id, newBidPrice]
    );

    await connection.query(
      "UPDATE auction_items SET current_price = ? WHERE id = ?",
      [newBidPrice, auctionId]
    );

    // 최대 금액에 도달하면 자동 입찰 비활성화
    if (newBidPrice >= autoBid.max_price) {
      await connection.query(
        "UPDATE auto_bids SET active = FALSE WHERE id = ?",
        [autoBid.id]
      );
    }

    console.log(`자동 입찰: ${autoBid.nickname}님이 ${newBidPrice}원 입찰`);
  }
};

module.exports = bidService;
