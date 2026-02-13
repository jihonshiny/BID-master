const cron = require("node-cron");
const pool = require("../config/database");
const { sendMail } = require("../utils/mailer");

const startAuctionCron = (io) => {
  console.log("🔨 경매 스케줄러 시작");

  cron.schedule("* * * * *", async () => {
    try {
      const [expiredAuctions] = await pool.query(`
        SELECT id, title, seller_id, current_price, start_price
        FROM auction_items
        WHERE status = '진행중' AND end_time < NOW()
      `);

      for (const auction of expiredAuctions) {
        await closeAuction(auction, io);
      }

      if (expiredAuctions.length > 0) {
        console.log(`✅ ${expiredAuctions.length}개 경매 종료 처리 완료`);
      }
    } catch (error) {
      console.error("경매 종료 체크 에러:", error);
    }
  });

  cron.schedule("* * * * *", async () => {
    try {
      const [pendingAuctions] = await pool.query(`
        SELECT id, title
        FROM auction_items
        WHERE status = '대기' AND start_time <= NOW()
      `);

      if (pendingAuctions.length > 0) {
        const ids = pendingAuctions.map((a) => a.id);
        await pool.query(
          "UPDATE auction_items SET status = '진행중' WHERE id IN (?)",
          [ids]
        );
        console.log(`🚀 ${ids.length}개 경매 시작: ${pendingAuctions.map(a => a.title).join(", ")}`);
      }
    } catch (error) {
      console.error("경매 시작 체크 에러:", error);
    }
  });

  // 마감 임박 알림 (5분마다 체크)
  cron.schedule("*/5 * * * *", async () => {
    try {
      // 10분 후 마감되는 경매의 찜한 사용자에게 알림
      const [endingSoon] = await pool.query(`
        SELECT DISTINCT f.user_id, a.id AS auction_id, a.title, a.current_price,
               u.email, u.name
        FROM auction_favorites f
        JOIN auction_items a ON f.auction_id = a.id
        JOIN users u ON f.user_id = u.id
        WHERE a.status = '진행중'
          AND a.end_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 10 MINUTE)
          AND NOT EXISTS (
            SELECT 1 FROM auction_notifications n
            WHERE n.user_id = f.user_id
              AND n.auction_id = a.id
              AND n.type = 'ending_soon'
          )
      `);

      for (const item of endingSoon) {
        // 알림 저장
        await pool.query(
          `INSERT INTO auction_notifications
           (user_id, auction_id, type, message)
           VALUES (?, ?, 'ending_soon', ?)`,
          [
            item.user_id,
            item.auction_id,
            `${item.title} 경매가 10분 후 마감됩니다! 현재가: ${item.current_price.toLocaleString()}원`,
          ]
        );

        // Socket.io 알림 (연결된 경우)
        if (io) {
          io.to(`user_${item.user_id}`).emit("notification", {
            type: "ending_soon",
            auctionId: item.auction_id,
            title: item.title,
            message: `${item.title} 경매가 곧 마감됩니다!`,
          });
        }
      }

      if (endingSoon.length > 0) {
        console.log(`⏰ ${endingSoon.length}명에게 마감 임박 알림 발송`);
      }
    } catch (error) {
      console.error("마감 임박 알림 에러:", error);
    }
  });
};

// 경매 종료 처리
const closeAuction = async (auction, io) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 최고 입찰자 찾기
    const [highestBid] = await connection.query(
      `SELECT user_id, bid_price
       FROM bids
       WHERE auction_id = ?
       ORDER BY bid_price DESC
       LIMIT 1`,
      [auction.id]
    );

    if (highestBid.length > 0) {
      // 낙찰 처리
      const winnerId = highestBid[0].user_id;
      const finalPrice = highestBid[0].bid_price;

      // 경매 상태 업데이트
      await connection.query(
        `UPDATE auction_items
         SET status = '종료', winner_id = ?
         WHERE id = ?`,
        [winnerId, auction.id]
      );

      // 거래 내역 생성
      await connection.query(
        `INSERT INTO auction_transactions
         (auction_id, seller_id, buyer_id, final_price)
         VALUES (?, ?, ?, ?)`,
        [auction.id, auction.seller_id, winnerId, finalPrice]
      );

      // 낙찰자 포인트 차감
      await connection.query(
        "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
        [winnerId, -finalPrice, `경매 낙찰: ${auction.title}`]
      );

      // 판매자 포인트 지급 (수수료 10% 제외)
      const sellerAmount = Math.floor(finalPrice * 0.9);
      await connection.query(
        "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
        [auction.seller_id, sellerAmount, `경매 판매: ${auction.title}`]
      );

      // 낙찰자 알림
      await connection.query(
        `INSERT INTO auction_notifications
         (user_id, auction_id, type, message)
         VALUES (?, ?, 'won', ?)`,
        [
          winnerId,
          auction.id,
          `축하합니다! ${auction.title} 경매에 낙찰되었습니다. 낙찰가: ${finalPrice.toLocaleString()}원`,
        ]
      );

      // 패찰자 알림 (낙찰자 제외한 입찰자들)
      const [losers] = await connection.query(
        `SELECT DISTINCT user_id FROM bids
         WHERE auction_id = ? AND user_id != ?`,
        [auction.id, winnerId]
      );

      for (const loser of losers) {
        await connection.query(
          `INSERT INTO auction_notifications
           (user_id, auction_id, type, message)
           VALUES (?, ?, 'lost', ?)`,
          [
            loser.user_id,
            auction.id,
            `${auction.title} 경매가 종료되었습니다. 아쉽게도 낙찰되지 않았습니다.`,
          ]
        );
      }

      await connection.commit();

      console.log(`✅ 경매 낙찰: ${auction.title} (낙찰가: ${finalPrice.toLocaleString()}원)`);

      // Socket.io 알림
      if (io) {
        io.to(`auction_${auction.id}`).emit("auction_ended", {
          auctionId: auction.id,
          winnerId,
          finalPrice,
          reason: "경매 종료",
        });

        io.to(`user_${winnerId}`).emit("notification", {
          type: "won",
          auctionId: auction.id,
          title: auction.title,
          message: `축하합니다! ${auction.title} 경매에 낙찰되었습니다!`,
        });
      }

      // 이메일 발송
      try {
        const [winner] = await pool.query(
          "SELECT email, name FROM users WHERE id = ?",
          [winnerId]
        );

        if (winner[0]) {
          await sendMail(
            winner[0].email,
            "🎉 경매 낙찰 축하드립니다!",
            `${winner[0].name}님, ${auction.title} 경매에 낙찰되었습니다!\n\n최종 낙찰가: ${finalPrice.toLocaleString()}원\n\n거래를 진행해주세요.`
          );
        }
      } catch (emailError) {
        console.error("낙찰 이메일 발송 실패:", emailError);
      }
    } else {
      // 유찰 처리 (입찰자 없음)
      await connection.query(
        "UPDATE auction_items SET status = '유찰' WHERE id = ?",
        [auction.id]
      );

      // 판매자 알림
      await connection.query(
        `INSERT INTO auction_notifications
         (user_id, auction_id, type, message)
         VALUES (?, ?, 'lost', ?)`,
        [
          auction.seller_id,
          auction.id,
          `${auction.title} 경매가 유찰되었습니다. 입찰자가 없었습니다.`,
        ]
      );

      await connection.commit();

      console.log(`❌ 경매 유찰: ${auction.title} (입찰자 없음)`);

      if (io) {
        io.to(`auction_${auction.id}`).emit("auction_ended", {
          auctionId: auction.id,
          winnerId: null,
          finalPrice: null,
          reason: "유찰",
        });
      }
    }
  } catch (error) {
    await connection.rollback();
    console.error(`경매 종료 처리 실패 (ID: ${auction.id}):`, error);
  } finally {
    connection.release();
  }
};

module.exports = startAuctionCron;
