# 🚀 BID달인 배포 가이드

## 방법 1: Google Cloud Run (추천 ⭐)
가장 쉽고 빠른 방법! 서버리스로 자동 스케일링됨.

### 사전 준비
1. [Google Cloud Console](https://console.cloud.google.com/) 가입
2. 새 프로젝트 생성
3. Cloud Run API 활성화
4. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) 설치

### 배포 단계

```bash
# 1. 터미널에서 로그인
gcloud auth login

# 2. 프로젝트 설정
gcloud config set project [프로젝트ID]

# 3. 배포 (자동으로 Docker 빌드 + 배포)
gcloud run deploy bid-dalin \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated
```

### 환경변수 설정
```bash
gcloud run services update bid-dalin \
  --set-env-vars="JWT_SECRET=your_secret,AI_BASE_URL=http://your-ai-server:1234/v1"
```

### 결과
배포 완료 후 URL이 제공됩니다:
`https://bid-dalin-xxxxx-an.a.run.app`

---

## 방법 2: Google Compute Engine (VM)
서버를 직접 관리하고 싶을 때.

### 1. VM 인스턴스 생성
- Google Cloud Console → Compute Engine → VM 인스턴스
- 이미지: Ubuntu 22.04 LTS
- 머신 유형: e2-micro (무료), e2-small (유료)
- 방화벽: HTTP/HTTPS 트래픽 허용

### 2. SSH 접속 후 설치
```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL 설치
sudo apt-get install -y mysql-server
sudo mysql_secure_installation

# Git 클론
git clone [레포지토리URL] bid-dalin
cd bid-dalin

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
nano .env

# PM2로 실행 (백그라운드)
sudo npm install -g pm2
pm2 start app.js --name bid-dalin
pm2 save
pm2 startup
```

### 3. Nginx 리버스 프록시 (선택)
```bash
sudo apt-get install nginx

sudo nano /etc/nginx/sites-available/bid-dalin
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bid-dalin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 방법 3: Firebase Hosting + Cloud Functions
프론트엔드와 백엔드 분리 시.

---

## 🗄️ 데이터베이스 (Cloud SQL)

### MySQL 인스턴스 생성
1. Google Cloud Console → SQL
2. 인스턴스 만들기 → MySQL 선택
3. 인스턴스 ID, 비밀번호 설정
4. 연결 → 공개 IP 또는 비공개 IP 설정

### 연결 설정
```javascript
// src/config/database.js
const pool = mysql.createPool({
  host: '/cloudsql/[프로젝트ID]:[리전]:[인스턴스ID]',
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'my_app',
  socketPath: '/cloudsql/[CONNECTION_NAME]'
});
```

---

## 🔒 HTTPS 설정 (SSL)

### Cloud Run
자동으로 HTTPS 제공됨!

### Compute Engine
```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com
```

---

## 💰 비용 예상

| 서비스 | 무료 범위 | 월 예상 비용 |
|--------|----------|-------------|
| Cloud Run | 200만 요청/월 | $0 ~ $10 |
| Compute Engine (e2-micro) | 1개 무료 | $0 |
| Cloud SQL (db-f1-micro) | - | ~$10/월 |

---

## 체크리스트

- [ ] Google Cloud 계정 생성
- [ ] 결제 계정 연결
- [ ] 프로젝트 생성
- [ ] API 활성화 (Cloud Run, Cloud SQL)
- [ ] 환경변수 설정 (.env)
- [ ] 데이터베이스 마이그레이션
- [ ] 배포 테스트
- [ ] 도메인 연결 (선택)
