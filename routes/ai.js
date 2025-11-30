// routes/ai.js
const express = require("express");
const { ai } = require("../utils/geminiClient");
const { generateOralCareTip } = require("../services/oralTipsService");
const { pool } = require("../config/database");

const router = express.Router();
const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Gemini가 ```json ... ``` 같이 돌려줘도
 * 순수 JSON 문자열만 뽑아내는 유틸 함수
 */
function extractJsonFromText(text) {
  if (!text) return "";

  let s = text.trim();

  // ``` 또는 ```json 으로 시작하는 경우 코드블록 제거
  if (s.startsWith("```")) {
    // 첫 줄( ``` 또는 ```json ) 제거
    const firstNewline = s.indexOf("\n");
    if (firstNewline !== -1) {
      s = s.substring(firstNewline + 1);
    }

    // 마지막 ``` 제거
    const lastFence = s.lastIndexOf("```");
    if (lastFence !== -1) {
      s = s.substring(0, lastFence);
    }
  }

  return s.trim();
}

/**
 * 공통: Gemini 응답을 JSON으로 파싱
 */
function parseGeminiJsonOrThrow(text, contextLabel = "Gemini JSON") {
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
router.get("/test", async (req, res) => {
  try {
    const prompt =
      "제미나이 GenAI SDK 테스트입니다. 공손한 한국어로 한 줄 인사해 주세요.";

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
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
    console.error("Gemini Test Error:", error);
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
router.get("/today-tip", async (req, res) => {
  try {
    const tip = await generateOralCareTip();

    return res.json({
      success: true,
      tip,
    });
  } catch (error) {
    console.error("Today Tip Error:", error);
    return res.status(500).json({
      success: false,
      message: "오늘의 Tip을 생성하는 중 오류가 발생했습니다.",
      error: IS_DEV ? error.message : undefined,
    });
  }
});

// -----------------------------------------------------
// 1) 설문 결과 분석 API
// POST /api/ai/survey-analysis
// -----------------------------------------------------
router.post("/survey-analysis", async (req, res) => {
  const { user_id, survey_session_id } = req.body;

  if (!user_id || !survey_session_id) {
    return res.status(400).json({
      success: false,
      message: "user_id와 survey_session_id는 필수입니다.",
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
        message: "해당 세션의 설문 응답이 없습니다.",
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
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.text || "";
    const analysis = parseGeminiJsonOrThrow(text, "survey-analysis");

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
      message: "설문 분석 완료",
      analysis,
    });
  } catch (error) {
    console.error("survey-analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "설문 분석 중 오류 발생",
      error: IS_DEV ? error.message : undefined,
    });
  }
});

// -------------------------------------------
// 2) 구강 용품 추천 API
// POST /api/ai/recommendations
// -------------------------------------------
router.post("/recommendations", async (req, res) => {
  const { user_id, survey_session_id } = req.body;

  if (!user_id || !survey_session_id) {
    return res.status(400).json({
      success: false,
      message: "user_id와 survey_session_id는 필수입니다.",
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
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // ✅ JSON만 받도록 강하게 지정
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // 🔍 응답 텍스트 확인용 로그
    let rawText = result && result.text ? result.text : "";
    console.log("🔍 raw recommendations text:", rawText);

    // 혹시 모를 코드블록/공백 제거
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      // ```json ... ``` 또는 ``` ... ``` 형태 제거
      cleaned = cleaned
        .replace(/^```[a-zA-Z0-9]*\s*/, "")
        .replace(/```$/, "")
        .trim();
    }

    let recommendations;
    try {
      recommendations = JSON.parse(cleaned);
    } catch (e) {
      console.error("recommendations JSON parse error:", e, cleaned);
      throw new Error("AI 응답을 JSON으로 해석하는 중 오류가 발생했습니다.");
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
      message: "추천 구강 용품 생성 완료",
      recommendations,
    });
  } catch (error) {
    console.error("recommendations error:", error);
    return res.status(500).json({
      success: false,
      message: "구강 용품 추천 생성 중 오류 발생",
      error: error.message,
    });
  }
});

// -----------------------------------------------------
// 3) 구강 사진 분석 결과 → Gemini 요약/해석 + DB 저장
// POST /api/ai/image-analysis
// -----------------------------------------------------
router.post("/image-analysis", async (req, res) => {
  /**
   * 기대하는 req.body 형식 (Flask 서버에서 받은 그대로 전달):
   * {
   *   "success": true,
   *   "data": {
   *     "history_id": "bd_2025_11_30_001",   // 3장(upper/lower/front)을 묶는 id
   *     "image_id": 123,                     // (DB에는 안 쓰고 raw_response에만 저장)
   *     "user_id": 8,
   *     "image_type": "upper",               // 'upper' | 'lower' | 'front'
   *     "uploaded_at": "2025-11-30T10:00:00",
   *     "analyzed_at": "2025-11-30T10:00:30",
   *     "cloudinary_url": "https://.../original.jpg",
   *     "result_cloudinary_url": "https://.../result.jpg",
   *     "analysis": {
   *       "occlusion_status": "보통",
   *       "cavity_detected": true,
   *       "cavity_locations": [16, 27],
   *       "overall_score": 75,
   *       "ai_confidence": 92.5,
   *       "comments": {
   *         "occlusion": "약간의 부정교합이 보입니다.",
   *         "cavity": "충치가 2개 발견되었습니다.",
   *         "recommendation": "가까운 치과 방문을 권장합니다."
   *       }
   *     }
   *   }
   * }
   */

  const flaskResult = req.body;

  if (!flaskResult || !flaskResult.data) {
    return res.status(400).json({
      success: false,
      message:
        "Flask 서버에서 전달된 분석 결과(JSON)가 없습니다. body.data 를 확인해 주세요.",
    });
  }

  const d = flaskResult.data;
  const {
    image_id, // DB에는 직접 안 넣고 raw_response에만 보관
    user_id,
    image_type,
    uploaded_at,
    analyzed_at,
    cloudinary_url,
    result_cloudinary_url,
  } = d;

  // history_id는 data 안에 있거나 최상단에 있을 수 있도록 둘 다 지원
  const history_id = d.history_id || flaskResult.history_id || null;

  if (!user_id || !history_id || !image_type) {
    return res.status(400).json({
      success: false,
      message: "user_id, history_id, image_type 는 필수입니다.",
    });
  }

  try {
    // 1) Gemini 프롬프트 구성 (질문에서 주신 형식 그대로, Flask 결과를 통째로 넣음)
    const prompt = `
당신은 전문 치과의사 AI입니다.

아래는 사용자의 구강 충치, 교합 사진 분석 결과 json을 바탕으로 유저의 구강 충치, 교합 사진 분석 결과를 JSON화하고, 위험요인, 개선해야 할 습관을 한국어로 정중하게 작성하세요.

분석 결과(JSON):
${JSON.stringify(flaskResult, null, 2)}

반드시 아래 JSON 형식만 출력하세요.
마크다운 코드블록(\`\`\`)이나 설명 문장 없이, 순수 JSON 객체만 응답하세요.

JSON 형식

{
  "success": true,
  "data": {
    "image_id": 123,
    "user_id": "user123",
    "image_type": "upper",
    "uploaded_at": "2025-11-30T10:00:00",
    "analyzed_at": "2025-11-30T10:00:30",

    "cloudinary_url": "https://.../original.jpg",
    "result_cloudinary_url": "https://.../result.jpg",

    "analysis": {
      "occlusion_status": "보통",
      "cavity_detected": true,
      "cavity_locations": [16, 27],
      "overall_score": 75,
      "ai_confidence": 92.5,
      "comments": {
        "occlusion": "부정교합 분석 결과 20자 이내",
        "cavity": "충치분석 결과 20자 이내",
        "recommendation": "분석 결과에 따른 추천 관리 방법"
      }
    }
  }
}
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        // JSON만 받도록 힌트
        responseMimeType: "application/json",
      },
    });

    const text = result.text || "";
    const aiJson = parseGeminiJsonOrThrow(text, "image-analysis");

    // --------------------------------------------------
    // 2) Gemini 응답에서 실제 분석 데이터 추출
    //    (위 프롬프트에서 정의한 구조를 기준으로 파싱)
    // --------------------------------------------------
    const aiData = aiJson.data || {};
    const analysis = aiData.analysis || {};
    const comments = analysis.comments || {};

    // image_analysis 테이블 스키마에 맞는 값 매핑
    const analysis_status = "completed"; // 단순 상태값, 필요 시 변경
    const occlusion_status = analysis.occlusion_status || null;
    const cavity_detected = analysis.cavity_detected ? 1 : 0;
    const cavity_locations = Array.isArray(analysis.cavity_locations)
      ? JSON.stringify(analysis.cavity_locations)
      : JSON.stringify([]);
    const overall_score = analysis.overall_score ?? null;
    const ai_confidence = analysis.ai_confidence ?? null;

    const occlusion_comment = comments.occlusion || null;
    const cavity_comment = comments.cavity || null;
    const recommendations = comments.recommendation || null;

    // --------------------------------------------------
    // 3) DB 저장 (image_analysis 스키마에 맞게 INSERT)
    //    컬럼 목록:
    //    id (PK, auto inc)
    //    user_id (int)
    //    history_id (varchar)
    //    cloudinary_url (text)
    //    image_type (varchar)
    //    uploaded_at (timestamp)
    //    analysis_status (varchar)
    //    occlusion_status (varchar)
    //    occlusion_comment (text)
    //    cavity_detected (tinyint)
    //    cavity_locations (longtext)
    //    cavity_comment (text)
    //    overall_score (decimal)
    //    recommendations (text)
    //    ai_confidence (decimal)
    //    raw_response (longtext)
    //    result_cloudinary_url (text)
    //    analyzed_at (timestamp)
    // --------------------------------------------------

    await pool.query(
      `
      INSERT INTO image_analysis (
        user_id,
        history_id,
        cloudinary_url,
        image_type,
        uploaded_at,
        analysis_status,
        occlusion_status,
        occlusion_comment,
        cavity_detected,
        cavity_locations,
        cavity_comment,
        overall_score,
        recommendations,
        ai_confidence,
        raw_response,
        result_cloudinary_url,
        analyzed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        user_id,
        history_id,
        cloudinary_url || null,
        image_type || null,
        uploaded_at || null,
        analysis_status,
        occlusion_status,
        occlusion_comment,
        cavity_detected,
        cavity_locations,
        cavity_comment,
        overall_score,
        recommendations,
        ai_confidence,
        JSON.stringify({
          flask_result: flaskResult,
          gemini_result: aiJson,
          image_id_from_flask: image_id ?? null,
        }),
        result_cloudinary_url || null,
        analyzed_at || null,
      ]
    );

    return res.json({
      success: true,
      message: "구강 사진 AI 분석 결과가 저장되었습니다.",
      data: aiJson,
    });
  } catch (error) {
    console.error("image-analysis AI error:", error);
    return res.status(500).json({
      success: false,
      message: "구강 사진 AI 분석 처리 중 오류가 발생했습니다.",
      error: IS_DEV ? error.message : undefined,
    });
  }
});

// -----------------------------------------------------
// 4) 구강 사진 분석 상세 조회 API
// GET /api/ai/image-analysis/history/:historyId?user_id=8
// -----------------------------------------------------
router.get("/image-analysis/history/:historyId", async (req, res) => {
  const { historyId } = req.params;
  const user_id = req.query.user_id; // RN에서 쿼리로 같이 넘겨주는 형태

  if (!historyId || !user_id) {
    return res.status(400).json({
      success: false,
      message: "historyId(path)와 user_id(query)는 필수입니다.",
    });
  }

  try {
    // 1) 해당 유저 + history_id 에 해당하는 3장(upper/lower/front) 조회
    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        history_id,
        cloudinary_url,
        result_cloudinary_url,
        image_type,
        uploaded_at,
        analyzed_at,
        analysis_status,
        occlusion_status,
        occlusion_comment,
        cavity_detected,
        cavity_locations,
        cavity_comment,
        overall_score,
        recommendations,
        ai_confidence
      FROM image_analysis
      WHERE user_id = ?
        AND history_id = ?
      ORDER BY
        CASE image_type
          WHEN 'upper' THEN 1
          WHEN 'lower' THEN 2
          WHEN 'front' THEN 3
          ELSE 99
        END,
        id ASC
      `,
      [user_id, historyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 history_id에 대한 분석 결과가 없습니다.",
      });
    }

    // 2) cavity_locations JSON 파싱(저장된 값이 문자열이기 때문)
    const parseLocations = (value) => {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn("cavity_locations JSON parse error:", e);
        return [];
      }
    };

    const records = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      history_id: r.history_id,
      image_type: r.image_type, // 'upper' | 'lower' | 'front'
      cloudinary_url: r.cloudinary_url,
      result_cloudinary_url: r.result_cloudinary_url,
      uploaded_at: r.uploaded_at,
      analyzed_at: r.analyzed_at,
      analysis_status: r.analysis_status,
      occlusion_status: r.occlusion_status,
      occlusion_comment: r.occlusion_comment,
      cavity_detected: !!r.cavity_detected,
      cavity_locations: parseLocations(r.cavity_locations),
      cavity_comment: r.cavity_comment,
      overall_score: r.overall_score !== null ? Number(r.overall_score) : null,
      recommendations: r.recommendations,
      ai_confidence: r.ai_confidence !== null ? Number(r.ai_confidence) : null,
    }));

    // 3) history 단위 메타 정보(대표 timestamp 등) 구성
    const first = rows[0];
    const responseData = {
      history_id: historyId,
      user_id: Number(user_id),
      // 대표 날짜는 첫 번째 row 기준으로 사용 (필요하면 min/max 로 다시 계산 가능)
      uploaded_at: first.uploaded_at,
      analyzed_at: first.analyzed_at,
      records, // 3개(upper/lower/front)가 여기에 담김
    };

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("GET /image-analysis/history/:historyId error:", error);
    return res.status(500).json({
      success: false,
      message: "이미지 분석 상세 조회 중 오류가 발생했습니다.",
      error: IS_DEV ? error.message : undefined,
    });
  }
});

module.exports = router;
