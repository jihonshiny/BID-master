const Joi = require("joi");

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(4).max(20).required(),
  name: Joi.string().required(),
  nickname: Joi.string().max(10),
});

const aiChatSchema = Joi.object({
  message: Joi.string().min(1).required(),
});

const diarySchema = Joi.object({
  content: Joi.string().min(1).required(),
});

// ============================================
// 경매 관련 스키마
// ============================================
const createAuctionSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(2000),
  category: Joi.string().max(50),
  start_price: Joi.number().integer().min(1000).required(),
  buy_now_price: Joi.number().integer().min(1000),
  duration: Joi.number().integer().min(1).max(168).default(24), // 최대 7일
});

const placeBidSchema = Joi.object({
  auction_id: Joi.number().integer().positive().required(),
  bid_price: Joi.number().integer().min(1000).required(),
});

const setAutoBidSchema = Joi.object({
  auction_id: Joi.number().integer().positive().required(),
  max_price: Joi.number().integer().min(1000).required(),
});

// 스키마 객체
const schemas = {
  signup: signupSchema,
  aiChat: aiChatSchema,
  diary: diarySchema,
  createAuction: createAuctionSchema,
  placeBid: placeBidSchema,
  setAutoBid: setAutoBidSchema,
};

// 유효성 검사 미들웨어
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "유효성 검사 실패",
        details: error.details[0].message,
      });
    }
    req.body = value;
    next();
  };
};

module.exports = {
  signupSchema,
  aiChatSchema,
  diarySchema,
  schemas,
  validateBody,
};
