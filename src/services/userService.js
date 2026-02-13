const pool = require("../config/database");
const bcrypt = require("bcrypt");

const userService = {
  // 회원가입
  createUser: async (userData) => {
    const { email, password, name, nickname } = userData;

    // 이메일 중복 확인
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      throw new Error("이미 사용 중인 이메일입니다");
    }

    // 닉네임 중복 확인
    if (nickname) {
      const [existingNickname] = await pool.query(
        "SELECT id FROM users WHERE nickname = ?",
        [nickname]
      );

      if (existingNickname.length > 0) {
        throw new Error("이미 사용 중인 닉네임입니다");
      }
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const [result] = await pool.query(
      `INSERT INTO users (email, password, name, nickname)
       VALUES (?, ?, ?, ?)`,
      [email, hashedPassword, name, nickname || name]
    );

    const userId = result.insertId;

    // 신규 가입 포인트 지급 (3만 포인트)
    await pool.query(
      "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
      [userId, 30000, "신규 가입 보너스"]
    );

    return {
      id: userId,
      email,
      name,
      nickname: nickname || name,
    };
  },

  // 로그인
  login: async (email, password) => {
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      throw new Error("이메일 또는 비밀번호가 일치하지 않습니다");
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new Error("이메일 또는 비밀번호가 일치하지 않습니다");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
    };
  },

  // 사용자 정보 조회
  getUserById: async (userId) => {
    const [users] = await pool.query(
      `SELECT id, email, name, nickname, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return null;
    }

    return users[0];
  },

  // 포인트 조회
  getPoints: async (userId) => {
    const [result] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM points WHERE user_id = ?",
      [userId]
    );

    // 명시적으로 숫자로 변환하여 문자열 연결 방지
    return Number(result[0].total);
  },

  // 포인트 내역 조회
  getPointHistory: async (userId, limit = 20) => {
    const [rows] = await pool.query(
      `SELECT id, amount, reason, created_at
       FROM points
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return rows;
  },

  // 포인트 충전 (테스트용)
  addPoints: async (userId, amount, reason) => {
    await pool.query(
      "INSERT INTO points (user_id, amount, reason) VALUES (?, ?, ?)",
      [userId, amount, reason]
    );

    return await userService.getPoints(userId);
  },

  // 내 입찰 목록 조회
  getMyBids: async (userId) => {
    const [rows] = await pool.query(
      `SELECT
        b.id,
        b.auction_id,
        b.bid_price as my_bid,
        b.bid_time,
        a.title,
        a.image_url,
        a.current_price,
        a.status,
        a.end_time,
        CASE WHEN a.current_price = b.bid_price THEN 1 ELSE 0 END as is_highest
       FROM bids b
       JOIN auction_items a ON b.auction_id = a.id
       WHERE b.user_id = ?
       ORDER BY b.bid_time DESC`,
      [userId]
    );
    return rows;
  },

  // 내 경매 목록 조회
  getMyAuctions: async (userId) => {
    const [rows] = await pool.query(
      `SELECT
        a.*,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
       FROM auction_items a
       WHERE a.seller_id = ?
       ORDER BY a.created_at DESC`,
      [userId]
    );
    return rows;
  },

  // 내 찜 목록 조회
  getMyFavorites: async (userId) => {
    const [rows] = await pool.query(
      `SELECT
        a.*,
        u.nickname as seller_nickname,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
        TIMESTAMPDIFF(SECOND, NOW(), a.end_time) as remaining_seconds
       FROM auction_favorites f
       JOIN auction_items a ON f.auction_id = a.id
       JOIN users u ON a.seller_id = u.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return rows;
  },
};

module.exports = userService;
