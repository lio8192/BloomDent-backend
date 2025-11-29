// routes/ai.js
const express = require('express');
const { ai } = require('../utils/geminiClient');
const { generateOralCareTip } = require('../services/oralTipsService');

const router = express.Router();

// GET /api/ai/test
router.get('/test', async (req, res) => {
  try {
    const prompt = '제미나이 GenAI SDK 테스트입니다. 공손한 한국어로 한 줄 인사해 주세요.';

    const result = await ai.models.generateContent({
      // 빠르고 저렴한 버전: gemini-2.0-flash, 더 강력: gemini-2.5-pro
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    // 새 SDK는 result.text 형태로 바로 텍스트를 줍니다.
    const text = result.text;

    return res.json({
      success: true,
      message: text,
    });
  } catch (error) {
    console.error('Gemini Test Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 오늘의 구강 관리 Tip 라우트
// GET /api/ai/today-tip
router.get('/today-tip', async (req, res) => {
  try {
    const tip = await generateOralCareTip();

    return res.json({
      success: true,
      tip,
    });
  } catch (error) {
    console.error('Today Tip Error:', error);
    return res.status(500).json({
      success: false,
      message: '오늘의 Tip을 생성하는 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;