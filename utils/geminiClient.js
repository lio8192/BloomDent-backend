// utils/geminiClient.js
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// AI Studio에서 받은 키 사용 (Vertex AI 안 씀)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  // apiVersion: 'v1', // 기본이 v1beta지만, 필요하면 명시도 가능
});

// 필요하면 여기서 공용 헬퍼도 만들 수 있음
module.exports = { ai };