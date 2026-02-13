FROM node:18-alpine

WORKDIR /app

# 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 포트 설정
EXPOSE 3000

# 환경변수
ENV NODE_ENV=production
ENV PORT=3000

# 앱 실행
CMD ["node", "app.js"]
