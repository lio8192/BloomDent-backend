// routes/ai.js
const express = require('express');
const { ai } = require('../utils/geminiClient');
const { generateOralCareTip } = require('../services/oralTipsService');
const { pool } = require('../config/database');

const router = express.Router();
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Gemini가 ```json ... ``` 같이 돌려줘도
 * 순수 JSON 문자열만 뽑아내는 유틸 함수
 */
function extractJsonFromText(text) {
  if (!text) return '';

  let s = text.trim();

  // ``` 또는 ```json 으로 시작하는 경우 코드블록 제거
  if (s.startsWith('```')) {
    // 첫 줄( ``` 또는 ```json ) 제거
    const firstNewline = s.indexOf('\n');
    if (firstNewline !== -1) {
      s = s.substring(firstNewline + 1);
    }

    // 마지막 ``` 제거
    const lastFence = s.lastIndexOf('```');
    if (lastFence !== -1) {
      s = s.substring(0, lastFence);
    }
  }

  return s.trim();
}

/**
 * 공통: Gemini 응답을 JSON으로 파싱
 */
function parseGeminiJsonOrThrow(text, contextLabel = 'Gemini JSON') {
  const cleaned = extractJsonFromText(text);
  console.log(`🔍 ${contextLabel} rawText:`, text);
  console.log(`🔍 ${contextLabel} cleaned:`, cleaned);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`❌ ${contextLabel} JSON 파싱 실패:`, e);
    throw new Error(
      `${contextLabel} 파싱 중 오류가 발생했습니다: ${e.message}`
    );
  }
}

// -----------------------------------------------------
// GET /api/ai/test
// -----------------------------------------------------
router.get('/test', async (req, res) => {
  try {
    const prompt =
      '제미나이 GenAI SDK 테스트입니다. 공손한 한국어로 한 줄 인사해 주세요.';

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

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

// -----------------------------------------------------
// 오늘의 구강 관리 Tip
// GET /api/ai/today-tip
// -----------------------------------------------------
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
      error: IS_DEV ? error.message : undefined,
    });
  }
});

// -----------------------------------------------------
// 1) 설문 결과 분석 API
// POST /api/ai/survey-analysis
// -----------------------------------------------------
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

반드시 아래 JSON 형식만 출력하세요.
마크다운 코드블록(\`\`\`)이나 설명 문장 없이, 순수 JSON 객체만 응답하세요.

{
  "summary": "총평",
  "details": "세부 분석 결과",
  "risk_factors": ["위험 요소 1", "위험 요소 2"],
  "improvements": ["개선 행동 1", "개선 행동 2"]
}
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.text || '';
    const analysis = parseGeminiJsonOrThrow(text, 'survey-analysis');

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
      error: IS_DEV ? error.message : undefined,
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
    // ✅ 설문 응답 + option_text 조인해서 조회
    const [responses] = await pool.query(
      `
      SELECT 
        usr.question_number,
        usr.option_number,
        sqo.option_text,
        usr.category,
        usr.score
      FROM user_survey_responses usr
      JOIN survey_question_options sqo
        ON usr.question_number = sqo.question_number
       AND usr.option_number   = sqo.option_number
      WHERE usr.user_id = ? AND usr.survey_session_id = ?
      ORDER BY usr.question_number ASC
      `,
      [user_id, survey_session_id]
    );

    const prompt = `
당신은 치과 전문 판매 AI입니다.
아래 설문 결과를 참고하여 사용자의 구강 상태에 맞는 구강 용품 3~5개를 추천하세요.

각 제품은:
- 이름(name)
- 구매 링크(쿠팡 또는 네이버)(link)
- 추천 이유(한국어)(reason)

응답 데이터(JSON):
${JSON.stringify(responses, null, 2)}

반드시 **유효한 JSON 배열만** 출력하세요.
어떠한 설명 문장이나 마크다운, 코드블록( \`\`\` )도 넣지 마세요.

출력 형식(JSON only):
[
  {
    "name": "제품명",
    "link": "https://example.com",
    "reason": "추천 이유"
  }
]
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // ✅ JSON만 받도록 강하게 지정
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // 🔍 응답 텍스트 확인용 로그
    let rawText = (result && result.text) ? result.text : '';
    console.log('🔍 raw recommendations text:', rawText);

    // 혹시 모를 코드블록/공백 제거
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      // ```json ... ``` 또는 ``` ... ``` 형태 제거
      cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/```$/, '').trim();
    }

    let recommendations;
    try {
      recommendations = JSON.parse(cleaned);
    } catch (e) {
      console.error('recommendations JSON parse error:', e, cleaned);
      throw new Error('AI 응답을 JSON으로 해석하는 중 오류가 발생했습니다.');
    }

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