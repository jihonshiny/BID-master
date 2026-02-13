# 📚 BID달인 프로젝트 - 수업 내용 연관성

## 이 프로젝트에서 사용된 기술과 수업 내용 매핑

---

## 1️⃣ Node.js & Express.js (백엔드)

### 수업에서 배운 내용
- Express 서버 구축
- 라우팅 (GET, POST, PUT, DELETE)
- 미들웨어 사용
- RESTful API 설계

### 프로젝트 적용
```
📁 app.js                 → Express 서버 설정
📁 src/routes/            → API 라우팅
📁 src/controllers/       → 비즈니스 로직
📁 src/middlewares/       → 인증, 유효성 검사
```

**예시 코드 (라우팅)**
```javascript
// src/routes/auctionRoute.js
router.get("/", auctionController.getAuctions);      // 목록 조회
router.post("/", verifyToken, auctionController.createAuction);  // 등록
router.put("/:id", verifyToken, auctionController.updateAuction); // 수정
router.delete("/:id", verifyToken, auctionController.deleteAuction); // 삭제
```

---

## 2️⃣ MySQL 데이터베이스

### 수업에서 배운 내용
- SQL 쿼리 (SELECT, INSERT, UPDATE, DELETE)
- 테이블 설계 (정규화)
- JOIN 연산
- mysql2 라이브러리 사용

### 프로젝트 적용
```
📁 src/config/database.js  → DB 연결 풀
📁 src/services/           → SQL 쿼리 실행
📁 database/               → 스키마, 초기 데이터
```

**예시 코드 (SQL 쿼리)**
```javascript
// 경매 목록 조회 (JOIN 사용)
const [auctions] = await pool.query(`
  SELECT a.*, u.name as seller_name, u.nickname as seller_nickname,
         (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
  FROM auction_items a
  JOIN users u ON a.seller_id = u.id
  WHERE a.status = ?
  ORDER BY a.created_at DESC
`, [status]);
```

**테이블 관계**
```
users (1) ──────< (N) auction_items
users (1) ──────< (N) bids
auction_items (1) ──────< (N) bids
```

---

## 3️⃣ 사용자 인증 (JWT)

### 수업에서 배운 내용
- 세션 vs 토큰 인증
- JWT (JSON Web Token) 구조
- 비밀번호 해싱 (bcrypt)
- 미들웨어를 통한 인증 처리

### 프로젝트 적용
```
📁 src/middlewares/auth.js  → JWT 검증 미들웨어
📁 src/controllers/userController.js → 로그인/회원가입
```

**예시 코드**
```javascript
// JWT 토큰 생성
const token = jwt.sign(
  { id: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// JWT 검증 미들웨어
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: '인증 실패' });
    req.user = decoded;
    next();
  });
};
```

---

## 4️⃣ 실시간 통신 (Socket.io)

### 수업에서 배운 내용
- WebSocket 개념
- Socket.io 라이브러리
- 이벤트 기반 통신
- 룸(Room) 개념

### 프로젝트 적용
```
📁 app.js → Socket.io 서버 설정, 이벤트 핸들러
```

**예시 코드**
```javascript
// 경매방 입장
socket.on("join_auction", (auctionId) => {
  socket.join(`auction_${auctionId}`);
});

// 실시간 입찰 브로드캐스트
io.to(`auction_${auctionId}`).emit("new_bid", {
  nickname: socket.user.nickname,
  bidPrice: bidPrice
});

// 1:1 채팅
socket.on("send_private_message", (data) => {
  io.to(roomId).emit("private_message", chatMessage);
});
```

---

## 5️⃣ React (프론트엔드)

### 수업에서 배운 내용
- 컴포넌트 기반 개발
- useState, useEffect 훅
- Props와 State
- 조건부 렌더링
- 이벤트 핸들링

### 프로젝트 적용
```
📁 public/index.html → React 컴포넌트들
```

**예시 코드**
```jsx
// 상태 관리
const [auctions, setAuctions] = useState([]);
const [loading, setLoading] = useState(true);

// 데이터 로딩 (useEffect)
useEffect(() => {
  loadAuctions();
}, [selectedCategory]);

// 조건부 렌더링
{loading ? (
  <div className="spinner"></div>
) : (
  <div className="auction-grid">
    {auctions.map(auction => (
      <AuctionCard key={auction.id} auction={auction} />
    ))}
  </div>
)}
```

---

## 6️⃣ REST API 설계

### 수업에서 배운 내용
- HTTP 메서드 (GET, POST, PUT, DELETE)
- 상태 코드 (200, 201, 400, 401, 404, 500)
- JSON 데이터 형식
- API 문서화

### 프로젝트 API 목록
```
GET    /auctions              → 경매 목록
GET    /auctions/:id          → 경매 상세
POST   /auctions              → 경매 등록
PUT    /auctions/:id          → 경매 수정
DELETE /auctions/:id          → 경매 삭제
POST   /auctions/bid          → 입찰
GET    /users/my-bids         → 내 입찰 내역
POST   /users/login           → 로그인
POST   /users/signup          → 회원가입
```

---

## 7️⃣ 파일 업로드 (Multer)

### 수업에서 배운 내용
- multipart/form-data
- Multer 미들웨어
- 파일 저장 및 경로 관리

### 프로젝트 적용
```javascript
// 이미지 업로드 미들웨어
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post("/", upload.single("image"), auctionController.createAuction);
```

---

## 8️⃣ 외부 API 연동 (AI)

### 수업에서 배운 내용
- fetch / axios 사용
- API 키 관리 (.env)
- 비동기 처리 (async/await)
- 에러 핸들링

### 프로젝트 적용
```javascript
// LM Studio AI API 호출
const response = await aiClient.chat.completions.create({
  model: "llava-llama-3-8b-v1_1",
  messages: [
    { role: "user", content: [
      { type: "text", text: "이 상품을 분석해주세요" },
      { type: "image_url", image_url: { url: imageBase64 } }
    ]}
  ]
});
```

---

## 9️⃣ CSS & 반응형 디자인

### 수업에서 배운 내용
- Flexbox, Grid 레이아웃
- CSS 변수 (Custom Properties)
- 미디어 쿼리 (반응형)
- 애니메이션

### 프로젝트 적용
```css
/* CSS 변수 */
:root {
  --primary: #000000;
  --accent: #3b82f6;
  --success: #22c55e;
}

/* Grid 레이아웃 */
.home-layout {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  gap: 24px;
}

/* 반응형 */
@media (max-width: 900px) {
  .home-layout {
    grid-template-columns: 1fr;
  }
}
```

---

## 🎯 프로젝트 전체 구조

```
📁 nodeProject/
├── 📄 app.js                    ← 서버 진입점 (Express + Socket.io)
├── 📄 package.json              ← 의존성 관리
├── 📄 .env                      ← 환경변수
├── 📄 Dockerfile                ← 배포용
│
├── 📁 public/
│   └── 📄 index.html            ← React 프론트엔드
│
├── 📁 src/
│   ├── 📁 config/
│   │   ├── 📄 database.js       ← MySQL 연결
│   │   └── 📄 ai.js             ← AI API 설정
│   │
│   ├── 📁 controllers/          ← 비즈니스 로직
│   │   ├── 📄 auctionController.js
│   │   ├── 📄 bidController.js
│   │   └── 📄 userController.js
│   │
│   ├── 📁 services/             ← DB 쿼리
│   │   ├── 📄 auctionService.js
│   │   ├── 📄 bidService.js
│   │   └── 📄 aiService.js
│   │
│   ├── 📁 routes/               ← API 라우팅
│   │   ├── 📄 auctionRoute.js
│   │   └── 📄 userRoute.js
│   │
│   ├── 📁 middlewares/          ← 미들웨어
│   │   ├── 📄 auth.js           ← JWT 인증
│   │   ├── 📄 upload.js         ← 파일 업로드
│   │   └── 📄 validation.js     ← 유효성 검사
│   │
│   └── 📁 jobs/
│       └── 📄 auctionCron.js    ← 스케줄러
│
└── 📁 database/
    └── 📄 schema.sql            ← DB 스키마
```

---

## ✅ 수업 내용 체크리스트

| 수업 주제 | 적용 여부 | 프로젝트 위치 |
|----------|:--------:|--------------|
| Express 서버 구축 | ✅ | app.js |
| 라우팅 | ✅ | src/routes/ |
| 미들웨어 | ✅ | src/middlewares/ |
| MySQL 연동 | ✅ | src/config/database.js |
| SQL 쿼리 | ✅ | src/services/ |
| JWT 인증 | ✅ | src/middlewares/auth.js |
| 비밀번호 해싱 | ✅ | userController.js |
| Socket.io | ✅ | app.js |
| React 컴포넌트 | ✅ | public/index.html |
| useState/useEffect | ✅ | 모든 컴포넌트 |
| REST API | ✅ | src/routes/ |
| 파일 업로드 | ✅ | src/middlewares/upload.js |
| 외부 API 연동 | ✅ | src/services/aiService.js |
| CSS Flexbox/Grid | ✅ | public/index.html |
| 반응형 디자인 | ✅ | @media 쿼리 |

---

## 💡 추가로 배울 수 있는 것들

이 프로젝트를 확장하면서 배울 수 있는 추가 개념:
- TypeScript 적용
- 테스트 코드 (Jest, Mocha)
- CI/CD (GitHub Actions)
- Docker & Kubernetes
- Redis 캐싱
- GraphQL
- 마이크로서비스 아키텍처
