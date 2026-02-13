require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./src/config/database");
const logger = require("./src/utils/logger");

const PORT = Number(process.env.PORT) || 3000;

// 어드민 이메일 (문의 알림 수신)
const ADMIN_EMAIL = 'admin@test.com';

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Port already in use: ${PORT}.`);
    process.exit(1);
  }
  throw err;
});

app.use(express.json());
app.use(cors());

// 정적 파일 서빙 (React 프론트엔드)
app.use(express.static(path.join(__dirname, "public")));

// 로깅 미들웨어 (라우터보다 먼저!)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 라우터
const auctionRouter = require("./src/routes/auctionRoute");
const userRouter = require("./src/routes/userRoute");

// Socket.io 객체를 app에 저장 (컨트롤러에서 사용)
app.set("io", io);

// API 라우트
app.use("/users", userRouter);
app.use("/auctions", auctionRouter);

// JSON 파싱 에러 핸들러
app.use((err, req, res, next) => {
  const isJsonParseError =
    err instanceof SyntaxError && err.status === 400 && "body" in err;

  if (isJsonParseError) {
    return res.status(400).json({
      message: "Invalid JSON in request body",
      error: err.message,
    });
  }
  next(err);
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  logger.error(err.stack);

  res.status(500).json({
    message: "서버 에러가 발생했습니다",
    error: err.message,
  });
});

// Socket.io 인증 미들웨어
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("토큰이 없습니다. 로그인 해주세요"));
  }

  // 데모 토큰 처리
  if (token === "demo-token-12345") {
    socket.user = {
      id: 1,
      name: "테스트유저",
      nickname: "입찰왕",
      email: "demo@test.com"
    };
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error("인증 실패 (유효하지 않은 토큰)"));
    }
    socket.user = decoded;
    next();
  });
});

// Socket.io 이벤트 핸들러
io.on("connection", async (socket) => {
  console.log("사용자 연결됨:", socket.user.id);

  try {
    const [userRows] = await pool.query(
      `SELECT nickname FROM users WHERE id = ?`,
      [socket.user.id]
    );
    if (userRows[0]) {
      socket.user.nickname = userRows[0].nickname;
      socket.emit("my_nickname", userRows[0].nickname);
    }
  } catch (err) {
    console.log("닉네임 조회 에러: ", err);
  }

  // ===== 경매 실시간 기능 =====

  // 사용자 개인 룸 입장 (알림용)
  socket.join(`user_${socket.user.id}`);

  // 경매 페이지 입장
  socket.on("join_auction", async (auctionId) => {
    socket.join(`auction_${auctionId}`);
    console.log(`${socket.user.nickname}님이 경매 ${auctionId}에 입장`);

    try {
      // 현재 경매 정보 전송
      const [auction] = await pool.query(
        "SELECT current_price, end_time, status FROM auction_items WHERE id = ?",
        [auctionId]
      );

      if (auction[0]) {
        socket.emit("auction_info", {
          currentPrice: auction[0].current_price,
          endTime: auction[0].end_time,
          status: auction[0].status,
        });
      }

      // 최근 입찰 내역 전송
      const [recentBids] = await pool.query(
        `SELECT b.bid_price, b.bid_time, b.is_auto_bid, u.nickname
         FROM bids b
         JOIN users u ON b.user_id = u.id
         WHERE b.auction_id = ?
         ORDER BY b.bid_time DESC
         LIMIT 10`,
        [auctionId]
      );

      socket.emit("recent_bids", recentBids);

      // 현재 시청자 수
      const room = io.sockets.adapter.rooms.get(`auction_${auctionId}`);
      const viewerCount = room ? room.size : 0;
      io.to(`auction_${auctionId}`).emit("viewer_count", { auctionId, count: viewerCount });
    } catch (err) {
      console.log("경매 정보 조회 에러:", err);
    }
  });

  // 경매 페이지 퇴장
  socket.on("leave_auction", (auctionId) => {
    socket.leave(`auction_${auctionId}`);
    console.log(`${socket.user.nickname}님이 경매 ${auctionId}에서 퇴장`);

    const room = io.sockets.adapter.rooms.get(`auction_${auctionId}`);
    const viewerCount = room ? room.size : 0;
    io.to(`auction_${auctionId}`).emit("viewer_count", { auctionId, count: viewerCount });
  });

  // 실시간 입찰 (Socket.io 통해 입찰)
  socket.on("place_bid", async (data) => {
    const { auctionId, bidPrice } = data;
    const userId = socket.user.id;

    try {
      const bidService = require("./src/services/bidService");
      const result = await bidService.placeBid(userId, auctionId, bidPrice);

      // 입찰 성공 - 모든 사용자에게 브로드캐스트
      io.to(`auction_${auctionId}`).emit("new_bid", {
        userId,
        nickname: socket.user.nickname,
        bidPrice,
        bidTime: new Date(),
      });

      io.to(`auction_${auctionId}`).emit("price_update", {
        currentPrice: result.currentPrice,
      });

      socket.emit("bid_success", { message: "입찰 성공!", currentPrice: result.currentPrice });
    } catch (error) {
      socket.emit("bid_error", { message: error.message });
    }
  });

  // 입찰 중 표시 (다른 사용자에게 알림)
  socket.on("bidding", (auctionId) => {
    socket.to(`auction_${auctionId}`).emit("user_bidding", {
      nickname: socket.user.nickname,
      message: `${socket.user.nickname}님이 입찰 중...`,
    });
  });

  // ===== 채팅 기능 =====

  // 채팅 메시지 전송
  socket.on("send_chat", (data) => {
    const { auctionId, message } = data;

    const chatMessage = {
      id: Date.now(),
      auctionId,
      userId: socket.user.id,
      nickname: socket.user.nickname || socket.user.name,
      message,
      timestamp: new Date().toISOString(),
      type: "chat"
    };

    // 같은 경매방의 모든 사용자에게 전송
    io.to(`auction_${auctionId}`).emit("new_chat", chatMessage);

    // 본인에게도 직접 전송 (App Engine polling 환경에서 방 join 문제 우회)
    socket.emit("new_chat", chatMessage);
  });

  // 이모지 반응 전송
  socket.on("send_reaction", (data) => {
    const { auctionId, emoji } = data;

    const reactionData = {
      nickname: socket.user.nickname || socket.user.name,
      emoji,
      timestamp: new Date().toISOString()
    };

    io.to(`auction_${auctionId}`).emit("new_reaction", reactionData);
    // 본인에게도 직접 전송
    socket.emit("new_reaction", reactionData);
  });

  // 타이핑 인디케이터
  socket.on("typing_start", (auctionId) => {
    socket.to(`auction_${auctionId}`).emit("user_typing", {
      nickname: socket.user.nickname || socket.user.name,
      isTyping: true
    });
  });

  socket.on("typing_stop", (auctionId) => {
    socket.to(`auction_${auctionId}`).emit("user_typing", {
      nickname: socket.user.nickname || socket.user.name,
      isTyping: false
    });
  });

  // ===== 1:1 채팅 (판매자-구매자) =====

  // 1:1 채팅방 입장
  socket.on("join_private_chat", (data) => {
    const { auctionId, sellerId, buyerId } = data;
    const roomId = `chat_${auctionId}_${Math.min(sellerId, buyerId)}_${Math.max(sellerId, buyerId)}`;
    socket.join(roomId);
    socket.currentChatRoom = roomId;
    console.log(`${socket.user.nickname}님이 1:1 채팅방 ${roomId}에 입장`);

    // 상대방에게 입장 알림
    socket.to(roomId).emit("partner_joined", {
      nickname: socket.user.nickname,
      userId: socket.user.id
    });
  });

  // 1:1 채팅 메시지 전송
  socket.on("send_private_message", async (data) => {
    const { auctionId, receiverId, message } = data;
    const senderId = socket.user.id;
    const roomId = `chat_${auctionId}_${Math.min(senderId, receiverId)}_${Math.max(senderId, receiverId)}`;

    const chatMessage = {
      id: Date.now(),
      auctionId,
      senderId,
      receiverId,
      senderNickname: socket.user.nickname || socket.user.name,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };

    // DB에 저장 (선택적)
    try {
      await pool.query(
        `INSERT INTO chats (auction_id, sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, ?, NOW())`,
        [auctionId, senderId, receiverId, message]
      );
    } catch (err) {
      console.log("채팅 저장 에러:", err.message);
    }

    // 채팅방의 모든 사용자에게 전송
    io.to(roomId).emit("private_message", chatMessage);

    // 수신자에게 알림 (온라인 상태면)
    io.to(`user_${receiverId}`).emit("new_message_notification", {
      senderId,
      senderNickname: socket.user.nickname,
      auctionId,
      preview: message.substring(0, 50)
    });

    // 어드민에게도 문의 알림 전송
    try {
      const [adminUser] = await pool.query(
        `SELECT id FROM users WHERE email = ?`,
        [ADMIN_EMAIL]
      );
      if (adminUser[0] && adminUser[0].id !== senderId && adminUser[0].id !== receiverId) {
        io.to(`user_${adminUser[0].id}`).emit("admin_inquiry_notification", {
          senderId,
          senderNickname: socket.user.nickname,
          auctionId,
          message: message.substring(0, 100),
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.log("어드민 알림 전송 에러:", err.message);
    }
  });

  // 1:1 채팅 타이핑 표시
  socket.on("private_typing", (data) => {
    const { receiverId, auctionId, isTyping } = data;
    const senderId = socket.user.id;
    const roomId = `chat_${auctionId}_${Math.min(senderId, receiverId)}_${Math.max(senderId, receiverId)}`;

    socket.to(roomId).emit("partner_typing", {
      userId: socket.user.id,
      nickname: socket.user.nickname,
      isTyping
    });
  });

  // 메시지 읽음 처리
  socket.on("mark_messages_read", async (data) => {
    const { auctionId, senderId } = data;
    const receiverId = socket.user.id;

    try {
      await pool.query(
        `UPDATE chats SET is_read = 1 WHERE auction_id = ? AND sender_id = ? AND receiver_id = ?`,
        [auctionId, senderId, receiverId]
      );

      // 발신자에게 읽음 알림
      io.to(`user_${senderId}`).emit("messages_read", {
        auctionId,
        readBy: receiverId
      });
    } catch (err) {
      console.log("읽음 처리 에러:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("사용자 연결 해제됨:", socket.user?.id);
  });
});

// 경매 Cron 스케줄러 시작
const startAuctionCron = require("./src/jobs/auctionCron");
startAuctionCron(io);

server.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});

module.exports = { app, server };
