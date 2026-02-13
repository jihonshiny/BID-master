const aiClient = require("../config/ai");

// AI 서버 활성화 여부 (연결 실패시 비활성화)
let aiEnabled = true;
let lastFailTime = null;
const RETRY_AFTER_MS = 60000; // 1분 후 재시도

// AI 호출 래퍼 함수
const callAI = async (fn) => {
  // AI 비활성화 상태이고, 아직 재시도 시간이 안 됐으면 바로 에러
  if (!aiEnabled && lastFailTime && (Date.now() - lastFailTime < RETRY_AFTER_MS)) {
    throw new Error("AI 서버 비활성화 상태");
  }

  try {
    const result = await fn();
    aiEnabled = true; // 성공하면 다시 활성화
    return result;
  } catch (error) {
    if (error.message.includes("Connection") || error.message.includes("ECONNREFUSED") || error.message.includes("timeout")) {
      aiEnabled = false;
      lastFailTime = Date.now();
      console.log("AI 서버 연결 실패 - 1분간 비활성화");
    }
    throw error;
  }
};

const aiService = {
  generateResponse: async () => {
    const completion = await aiClient.chat.completions.create({
      model: "essentialai/rnj-1",
      messages: [
        {
          role: "system",
          content: "너는 세계 최고의 동기부여 전문가야",
        },
        {
          role: "user",
          content:
            "학생들에게 힘이 되는 짧고 강렬한 한글 명언을 하나만 만들어줘 설명없이 명언만 말해",
        },
      ],
      temperature: 0.8,
    });

    return completion.choices[0].message.content;
  },

  analyzeDiary: async (diaryContent, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      const completion = await aiClient.chat.completions.create({
        model: "essentialai/rnj-1",
        messages: [
          {
            role: "system",
            content: "감정을 한 단어로, 코멘트는 15자 이내로 짧게 답해.",
          },
          {
            role: "user",
            content: `일기: "${diaryContent}"

JSON으로만 답해:
{"emotion": "기쁘당", "comment": "힘내지말고 힘내요요"}

감정 선택: 기쁨, 슬픔, 분노, 불안, 평화 중 하나
코멘트: 15자 이내로 짧게`,
          },
        ],
        temperature: 0.7,
      });

      const responseText = completion.choices[0].message.content;
      console.log(`AI 응답:`, responseText);

      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/'/g, '"')
        .trim();

      const jsonMatch = cleanedText.match(/\{[^}]+\}/);
      if (!jsonMatch) throw new Error("JSON 없음");

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.emotion || !parsed.comment) {
        throw new Error("필드 누락");
      }

      let shortComment = parsed.comment;
      if (shortComment.length > 20) {
        shortComment = shortComment.substring(0, 20) + "...";
      }

      return {
        emotion: parsed.emotion,
        comment: shortComment,
      };
    } catch (error) {
      console.error(`파싱 실패:`, error.message);

      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return aiService.analyzeDiary(diaryContent, retryCount + 1);
      }

      return {
        emotion: "평화",
        comment: "오늘도 수고했어요!",
      };
    }
  },

  // ============================================
  // 경매 관련 AI 기능
  // ============================================

  // 경매 가격 예측
  predictPrice: async (title, description, category, startPrice, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      const completion = await aiClient.chat.completions.create({
        model: "essentialai/rnj-1",
        messages: [
          {
            role: "system",
            content: "너는 중고거래 가격 예측 전문가야. JSON 형식으로만 답해.",
          },
          {
            role: "user",
            content: `상품명: ${title}
설명: ${description || "설명 없음"}
카테고리: ${category || "기타"}
시작가: ${startPrice}원

이 상품의 적정 낙찰 예상가를 예측해줘.

JSON 형식으로만 답해:
{"predicted_price": 예측가격(숫자만), "reason": "예측 근거 한 줄"}

조건:
- 예측가는 시작가의 1.0~2.0배 사이로 설정
- 인기 상품이면 높게, 그렇지 않으면 낮게`,
          },
        ],
        temperature: 0.7,
      });

      const responseText = completion.choices[0].message.content;
      console.log(`AI 가격 예측 응답:`, responseText);

      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/'/g, '"')
        .trim();

      const jsonMatch = cleanedText.match(/\{[^}]+\}/);
      if (!jsonMatch) throw new Error("JSON 없음");

      const parsed = JSON.parse(jsonMatch[0]);

      let predictedPrice = parseInt(parsed.predicted_price);

      // 범위 제한 (시작가의 1.0~2.0배)
      if (predictedPrice < startPrice) {
        predictedPrice = startPrice;
      }
      if (predictedPrice > startPrice * 2) {
        predictedPrice = Math.floor(startPrice * 2);
      }

      return predictedPrice;
    } catch (error) {
      console.error(`AI 가격 예측 실패:`, error.message);

      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return aiService.predictPrice(title, description, category, startPrice, retryCount + 1);
      }

      // 폴백: 시작가 + 20%
      return Math.floor(startPrice * 1.2);
    }
  },

  // 입찰 전략 추천
  recommendBidStrategy: async (auctionId, currentPrice, bidHistory, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      const recentBids = bidHistory.slice(0, 5).map(b => ({
        price: b.bid_price,
        time: b.bid_time,
      }));

      const completion = await aiClient.chat.completions.create({
        model: "essentialai/rnj-1",
        messages: [
          {
            role: "system",
            content: "너는 경매 전략 전문가야. JSON 형식으로만 답해.",
          },
          {
            role: "user",
            content: `현재가: ${currentPrice}원
최근 입찰 내역: ${JSON.stringify(recentBids)}
총 입찰 횟수: ${bidHistory.length}회

입찰 전략을 추천해줘.

JSON 형식으로만 답해:
{"strategy": "전략명", "recommended_price": 추천입찰가(숫자만), "tip": "팁 한 줄"}

전략 종류:
- "공격적": 경쟁이 치열할 때, 높은 금액으로 압도
- "안정적": 일반적인 상황, 적정 금액 입찰
- "스나이핑": 마감 직전 입찰 권장

추천 입찰가는 현재가보다 1000~10000원 높게 설정`,
          },
        ],
        temperature: 0.7,
      });

      const responseText = completion.choices[0].message.content;
      console.log(`AI 전략 추천 응답:`, responseText);

      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/'/g, '"')
        .trim();

      const jsonMatch = cleanedText.match(/\{[^}]+\}/);
      if (!jsonMatch) throw new Error("JSON 없음");

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        strategy: parsed.strategy || "안정적",
        recommended_price: parseInt(parsed.recommended_price) || currentPrice + 1000,
        tip: parsed.tip || "현재가보다 조금 높게 입찰하세요.",
      };
    } catch (error) {
      console.error(`AI 전략 추천 실패:`, error.message);

      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return aiService.recommendBidStrategy(auctionId, currentPrice, bidHistory, retryCount + 1);
      }

      // 폴백
      return {
        strategy: "안정적",
        recommended_price: currentPrice + 1000,
        tip: "현재가보다 조금 높게 입찰하세요.",
      };
    }
  },

  // 상품 이미지 분석 - 실제 AI 호출
  analyzeProductImage: async (base64Image, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      console.log("AI 이미지 분석 시작...");

      const completion = await aiClient.chat.completions.create({
        model: "llava-llama-3-8b-v1_1",
        messages: [
          {
            role: "system",
            content: `You are a JSON API. You MUST respond with ONLY valid JSON, no other text.
Analyze product images for a Korean secondhand marketplace.
IMPORTANT: Output ONLY the JSON object, nothing else. No explanations, no descriptions.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this product image and respond with ONLY this JSON format:
{"title":"상품명","category":"카테고리","condition":"상태","price_min":숫자,"price_max":숫자,"description":"설명"}

Rules:
- title: Korean product name, max 20 characters
- category: One of 전자기기, 게임, 가전, 스포츠, 도서, 패션, 식품, 기타
- condition: One of 상, 중, 하
- price_min/price_max: Estimated price in Korean Won (number only)
- description: Korean description, max 50 characters

OUTPUT ONLY JSON. NO OTHER TEXT.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const responseText = completion.choices[0].message.content;
      console.log(`AI 이미지 분석 응답:`, responseText);

      // JSON 파싱 - 여러 방법으로 시도
      let parsed = null;

      // 방법 1: 직접 파싱
      try {
        parsed = JSON.parse(responseText.trim());
      } catch (e) {
        // 방법 2: JSON 부분 추출
        const cleanedText = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .replace(/'/g, '"')
          .trim();

        const jsonMatch = cleanedText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      // JSON 파싱 실패 시, AI 응답에서 정보 추출 시도
      if (!parsed) {
        console.log("JSON 파싱 실패, AI 응답에서 정보 추출 시도...");

        // 응답 텍스트에서 키워드 추출
        const text = responseText.toLowerCase();
        let category = "기타";
        let estimatedPrice = 50000;

        // 카테고리 추측
        if (text.includes("refrigerator") || text.includes("냉장고") || text.includes("samsung") || text.includes("lg")) {
          category = "가전";
          estimatedPrice = 300000;
        } else if (text.includes("phone") || text.includes("laptop") || text.includes("computer")) {
          category = "전자기기";
          estimatedPrice = 200000;
        } else if (text.includes("book") || text.includes("책")) {
          category = "도서";
          estimatedPrice = 15000;
        } else if (text.includes("game") || text.includes("게임")) {
          category = "게임";
          estimatedPrice = 30000;
        } else if (text.includes("clothes") || text.includes("shirt") || text.includes("패션")) {
          category = "패션";
          estimatedPrice = 25000;
        }

        // 제목 추출 (첫 번째 볼드 또는 주요 명사)
        const titleMatch = responseText.match(/\*\*([^*]+)\*\*/);
        const extractedTitle = titleMatch ? titleMatch[1].replace(/[^가-힣a-zA-Z0-9\s]/g, '').substring(0, 20) : "";

        parsed = {
          title: extractedTitle || "상품",
          category: category,
          condition: "중",
          price_min: Math.floor(estimatedPrice * 0.7),
          price_max: estimatedPrice,
          description: "AI가 이미지를 분석했습니다."
        };
      }

      // 필수 필드 검증
      if (!parsed.title) parsed.title = "상품";
      if (!parsed.category) parsed.category = "기타";

      // 카테고리 검증
      const validCategories = ["전자기기", "게임", "가전", "스포츠", "도서", "패션", "식품", "기타"];
      if (!validCategories.includes(parsed.category)) {
        parsed.category = "기타";
      }

      // 상태 검증
      const validConditions = ["상", "중", "하"];
      if (!validConditions.includes(parsed.condition)) {
        parsed.condition = "중";
      }

      // 가격 검증
      parsed.price_min = parseInt(parsed.price_min) || 10000;
      parsed.price_max = parseInt(parsed.price_max) || parsed.price_min * 2;

      return parsed;
    } catch (error) {
      console.error(`AI 이미지 분석 실패 (시도 ${retryCount + 1}):`, error.message);

      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return aiService.analyzeProductImage(base64Image, retryCount + 1);
      }

      // 폴백 - AI 분석 실패시 기본값
      return {
        title: "",
        category: "기타",
        condition: "중",
        price_min: 10000,
        price_max: 50000,
        description: "AI 분석을 완료할 수 없습니다. 상품 정보를 직접 입력해주세요."
      };
    }
  },
};

module.exports = aiService;
