const OpenAI = require("openai");

// AI 서버 설정 (환경변수 또는 기본값)
const AI_BASE_URL = process.env.AI_BASE_URL || "http://10.26.139.167:1234/v1";
const AI_API_KEY = process.env.AI_API_KEY || "lm-studio";

const aiClient = new OpenAI({
  baseURL: AI_BASE_URL,
  apiKey: AI_API_KEY,
  timeout: 120000, // 120초 타임아웃 (이미지 분석용)
  maxRetries: 1,
});

// AI 서버 연결 상태 확인
console.log(`AI 서버 설정: ${AI_BASE_URL}`);

module.exports = aiClient;
