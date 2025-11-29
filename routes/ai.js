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

// -------------------------------------------
// 1) 설문 결과 분석 API
// POST /api/ai/survey-analysis
// -------------------------------------------
router.post('/survey-analysis', async (req, res) => {
  const { user_id, survey_session_id } = req.body;

  if (!user_id || !survey_session_id) {
    return res.status(400).json({
      success: false,
      message: 'user_id와 survey_session_id는 필수입니다.',
    });
  }

  try {
    // 1) 해당 세션 응답 불러오기
    const [responses] = await pool.query(
      `
      SELECT 
        usr.question_number,
        sq.question_text,
        usr.option_number,
        sqo.option_text,
        usr.score,
        usr.category
      FROM user_survey_responses usr
      JOIN survey_questions sq
        ON usr.question_number = sq.question_number
      JOIN survey_question_options sqo 
        ON usr.question_number = sqo.question_number
       AND usr.option_number   = sqo.option_number
      WHERE usr.user_id = ?
        AND usr.survey_session_id = ?
      ORDER BY usr.question_number ASC
      `,
      [user_id, survey_session_id]
    );

    if (responses.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 세션의 설문 응답이 없습니다.',
      });
    }

    // 2) Gemini에게 보낼 prompt 구성
    const prompt = `
당신은 전문 치과위생사 AI입니다.
아래는 사용자의 설문 응답입니다. 
유저의 구강 건강 상태를 분석하고, 위험요인, 개선해야 할 습관을 한국어로 정중하게 작성하세요.

응답 데이터(JSON):
${JSON.stringify(responses, null, 2)}

출력 형식(JSON):
{
  "summary": "총평",
  "details": "세부 분석 결과",
  "risk_factors": ["위험 요소 1", "위험 요소 2"],
  "improvements": ["개선 행동 1", "개선 행동 2"]
}
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const analysis = JSON.parse(result.text);

    // 3) DB 저장
    await pool.query(
      `
      INSERT INTO detail_survey (user_id, survey_session_id, analysis_json)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE analysis_json = VALUES(analysis_json)
      `,
      [user_id, survey_session_id, JSON.stringify(analysis)]
    );

    return res.json({
      success: true,
      message: '설문 분석 완료',
      analysis,
    });
  } catch (error) {
    console.error('survey-analysis error:', error);
    return res.status(500).json({
      success: false,
      message: '설문 분석 중 오류 발생',
      error: error.message,
    });
  }
});


// -------------------------------------------
// 2) 구강 용품 추천 API
// POST /api/ai/recommendations
// -------------------------------------------
router.post('/recommendations', async (req, res) => {
  const { user_id, survey_session_id } = req.body;

  if (!user_id || !survey_session_id) {
    return res.status(400).json({
      success: false,
      message: 'user_id와 survey_session_id는 필수입니다.',
    });
  }

  try {
    // 설문 응답 불러오기
    const [responses] = await pool.query(
      `
      SELECT 
        question_number, option_text, category, score
      FROM user_survey_responses
      WHERE user_id = ? AND survey_session_id = ?
      ORDER BY question_number ASC
      `,
      [user_id, survey_session_id]
    );

    const prompt = `
당신은 치과 전문 판매 AI입니다.
아래 설문 결과를 참고하여 사용자의 구강 상태에 맞는 구강 용품 3~5개를 추천하세요.

각 제품은:
- 이름
- 구매 링크(쿠팡 또는 네이버)
- 추천 이유(한국어)

응답 데이터:
${JSON.stringify(responses, null, 2)}

출력형식(JSON):
[
  {
    "name": "",
    "link": "",
    "reason": ""
  }
]
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const recommendations = JSON.parse(result.text);

    // DB 저장
    await pool.query(
      `
      INSERT INTO detail_survey (user_id, survey_session_id, recommendations_json)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE recommendations_json = VALUES(recommendations_json)
      `,
      [user_id, survey_session_id, JSON.stringify(recommendations)]
    );

    return res.json({
      success: true,
      message: '추천 구강 용품 생성 완료',
      recommendations,
    });
  } catch (error) {
    console.error('recommendations error:', error);
    return res.status(500).json({
      success: false,
      message: '구강 용품 추천 생성 중 오류 발생',
      error: error.message,
    });
  }
});

module.exports = router;