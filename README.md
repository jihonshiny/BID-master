# BID달인

실시간 온라인 경매 플랫폼

## 배포 주소
https://ace-ellipse-476008-c7.du.r.appspot.com

## 프로젝트 소개
경매에 관심은 있는데 기존 서비스들이 너무 복잡하고 실시간성이 떨어져서 직접 만들어봤습니다.
실시간으로 입찰하고 채팅하면서 경매에 참여할 수 있는 웹 서비스입니다.

## 기술 스택
- **Frontend**: React, HTML, CSS
- **Backend**: Node.js, Express
- **Database**: TiDB Cloud (MySQL)
- **실시간 통신**: Socket.io
- **배포**: Google App Engine

## 주요 기능

### 경매 시스템
- 실시간 입찰 (가격 즉시 반영)
- 자동 입찰 (최대 금액 설정하면 알아서 입찰)
- 경매 종료되면 자동으로 낙찰자 선정

### 실시간 기능
- 경매방 채팅
- 이모지 반응
- 입찰 알림

### 사용자 기능
- 회원가입/로그인
- 관심물품 등록
- 마이페이지에서 입찰/낙찰 내역 확인
- 판매자한테 1:1 문의

## 실행 방법

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev

# http://localhost:3000 접속
```

## 환경 변수 (.env)
```
PORT=3000
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
JWT_SECRET=your-jwt-secret
```

## 폴더 구조
```
├── public/
│   └── index.html       # 프론트엔드 (React)
├── src/
│   ├── config/          # DB 설정
│   ├── controllers/     # 컨트롤러
│   ├── routes/          # API 라우트
│   ├── services/        # 비즈니스 로직
│   ├── jobs/            # 스케줄러 (경매 종료 처리)
│   └── utils/           # 유틸 함수
├── app.js               # 서버 엔트리포인트
└── package.json
```

## 개발하면서 고민했던 부분

### Socket.io 연결 이슈
처음에 WebSocket으로 했는데 App Engine에서 안 돼서 polling 방식으로 바꿨습니다.
방 입장이 제대로 안 되는 문제가 있어서 메시지 전송할 때 본인한테도 직접 emit 하는 방식으로 해결했습니다.

### 자동 입찰 로직
다른 사람이 입찰하면 내 최대 금액까지 자동으로 따라가야 하는데,
무한루프 안 걸리게 하는 게 좀 까다로웠습니다. 입찰 단위 계산해서 처리했습니다.

### 실시간 알림
관심물품 가격 변동이나 경매 종료 알림을 실시간으로 보내야 해서
Socket.io 방 개념을 활용했습니다. 유저별로 개인 방 만들어서 알림 전송하는 식으로 구현했습니다.

## 화면

### 메인 페이지
- 경매 상품 리스트
- 카테고리 필터
- 검색

### 상품 상세
- 실시간 입찰
- 채팅
- 자동 입찰 설정

### 마이페이지
- 내 입찰 내역
- 낙찰 내역
- 관심물품
- 1:1 문의
