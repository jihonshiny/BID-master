# AuctionHub API - Postman 사용 가이드

## 📋 기본 설정

### Base URL
```
http://localhost:3000
```

### 인증 토큰 설정
모든 인증이 필요한 API 요청에는 Header에 토큰을 추가해야 합니다:
```
Key: Authorization
Value: Bearer <your-token>
```

---

## 🔐 1. 회원가입 & 로그인

### 1.1 회원가입
```
POST /users/signup
```

**Body (JSON):**
```json
{
    "email": "test@example.com",
    "password": "password123",
    "name": "홍길동",
    "nickname": "경매왕"
}
```

**응답:**
```json
{
    "message": "회원가입 성공",
    "user": {
        "id": 1,
        "email": "test@example.com",
        "name": "홍길동",
        "nickname": "경매왕"
    }
}
```

### 1.2 로그인
```
POST /users/login
```

**Body (JSON):**
```json
{
    "email": "test@example.com",
    "password": "password123"
}
```

**응답:**
```json
{
    "message": "로그인 성공",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": 1,
        "email": "test@example.com",
        "name": "홍길동",
        "nickname": "경매왕"
    }
}
```

⚠️ **중요:** 로그인 응답에서 받은 `token`을 복사해서 이후 모든 요청의 Authorization 헤더에 사용하세요!

---

## 🏷️ 2. 경매 관련 API

### 2.1 경매 목록 조회 (인증 불필요)
```
GET /auctions
GET /auctions?status=진행중
GET /auctions?category=전자기기
```

### 2.2 인기 경매 조회
```
GET /auctions/popular?limit=4
```

### 2.3 마감 임박 경매 조회
```
GET /auctions/ending-soon?limit=4
```

### 2.4 경매 상세 조회
```
GET /auctions/:id
```
예: `GET /auctions/1`

### 2.5 경매 검색
```
GET /auctions/search?q=아이폰
```

### 2.6 경매 등록 ⭐ (인증 필요)
```
POST /auctions
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your-token>
```

**Body (JSON):**
```json
{
    "title": "아이폰 14 Pro 256GB",
    "description": "미개봉 새상품입니다. 직거래 가능",
    "category": "전자기기",
    "start_price": 500000,
    "buy_now_price": 1000000,
    "duration": 24
}
```

**카테고리 옵션:**
- 전자기기
- 게임
- 가전
- 스포츠
- 도서
- 패션
- 기타

**duration (경매 기간):**
- 1 ~ 168 시간 (1시간 ~ 7일)

### 2.7 내 경매 목록 (인증 필요)
```
GET /auctions/my/auctions
```

---

## 💰 3. 입찰 관련 API

### 3.1 입찰하기 (인증 필요)
```
POST /auctions/bid
```

**Body (JSON):**
```json
{
    "auction_id": 1,
    "bid_price": 550000
}
```

### 3.2 입찰 내역 조회
```
GET /auctions/:auction_id/bids
```

### 3.3 내 입찰 내역 (인증 필요)
```
GET /auctions/bid/my
```

### 3.4 자동 입찰 설정 (인증 필요)
```
POST /auctions/auto-bid
```

**Body (JSON):**
```json
{
    "auction_id": 1,
    "max_price": 800000
}
```

### 3.5 자동 입찰 취소 (인증 필요)
```
DELETE /auctions/auto-bid/:auction_id
```

---

## 🤖 4. AI 기능 API

### 4.1 AI 입찰 전략 추천 (인증 필요)
```
GET /auctions/:id/strategy
```

**응답:**
```json
{
    "strategy": "안정적",
    "recommended_price": 560000,
    "tip": "현재 경쟁이 치열하지 않습니다. 적정 금액으로 입찰하세요."
}
```

### 4.2 AI 이미지 분석 (인증 필요)
```
POST /auctions/analyze-image
```

**Headers:**
```
Authorization: Bearer <your-token>
```

**Body (form-data):**
```
Key: image
Type: File
Value: <이미지 파일 선택>
```

**응답:**
```json
{
    "success": true,
    "analysis": {
        "title": "애플 에어팟 프로 2세대",
        "category": "전자기기",
        "condition": "중",
        "price_min": 150000,
        "price_max": 250000,
        "description": "애플의 무선 이어폰으로 노이즈 캔슬링 기능이 있습니다."
    }
}
```

---

## ❤️ 5. 찜 기능 API

### 5.1 찜 추가 (인증 필요)
```
POST /auctions/favorite
```

**Body (JSON):**
```json
{
    "auction_id": 1
}
```

### 5.2 찜 삭제 (인증 필요)
```
DELETE /auctions/favorite/:auction_id
```

### 5.3 내 찜 목록 (인증 필요)
```
GET /auctions/favorite/my
```

### 5.4 찜 여부 확인 (인증 필요)
```
GET /auctions/favorite/check/:auction_id
```

---

## 🛒 6. 즉시 구매 API

### 6.1 즉시 구매 (인증 필요)
```
POST /auctions/:id/buy-now
```

---

## 📝 Postman 설정 단계별 가이드

### Step 1: 새 요청 만들기
1. Postman 열기
2. **"+"** 버튼 클릭하여 새 탭 열기
3. HTTP 메서드 선택 (GET, POST, PUT, DELETE)
4. URL 입력

### Step 2: 회원가입하기
1. `POST` 선택
2. URL: `http://localhost:3000/users/signup`
3. **Body** 탭 클릭
4. **raw** 선택
5. 드롭다운에서 **JSON** 선택
6. 아래 내용 입력:
```json
{
    "email": "myemail@test.com",
    "password": "mypassword123",
    "name": "내이름",
    "nickname": "내닉네임"
}
```
7. **Send** 클릭

### Step 3: 로그인하기
1. `POST` 선택
2. URL: `http://localhost:3000/users/login`
3. Body에 입력:
```json
{
    "email": "myemail@test.com",
    "password": "mypassword123"
}
```
4. **Send** 클릭
5. 응답에서 **token** 값 복사!

### Step 4: 토큰 설정하기
1. **Headers** 탭 클릭
2. 새 행 추가:
   - Key: `Authorization`
   - Value: `Bearer 여기에토큰붙여넣기`

### Step 5: 경매 등록하기
1. `POST` 선택
2. URL: `http://localhost:3000/auctions`
3. Headers에 Authorization 토큰 추가
4. Body에 입력:
```json
{
    "title": "판매할 상품명",
    "description": "상품 설명",
    "category": "전자기기",
    "start_price": 10000,
    "buy_now_price": 50000,
    "duration": 24
}
```
5. **Send** 클릭

---

## 🎯 데모 토큰 (개발/테스트용)

프론트엔드 데모 로그인 시 사용되는 토큰:
```
demo-token-12345
```

이 토큰으로 API 테스트 가능:
```
Authorization: Bearer demo-token-12345
```

데모 사용자 정보:
- ID: 1
- 이름: 테스트유저
- 닉네임: 입찰왕
- 이메일: demo@test.com

---

## ⚠️ 자주 발생하는 오류

### 401 Unauthorized
- 토큰이 없거나 잘못됨
- 해결: Authorization 헤더 확인

### 400 Bad Request
- 필수 필드 누락
- 해결: Body 데이터 확인

### 404 Not Found
- 존재하지 않는 경매/사용자
- 해결: ID 확인

### 500 Internal Server Error
- 서버 오류
- 해결: 서버 로그 확인
