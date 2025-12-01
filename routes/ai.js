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
// 3) 구강 사진 분석 결과 → Gemini 요약/해석 + DB 업데이트
// POST /api/ai/image-analysis
// body: { user_id, history_id }
// -----------------------------------------------------
router.post("/image-analysis", async (req, res) => {
  const { user_id, history_id } = req.body;

  if (!user_id || !history_id) {
    return res.status(400).json({
      success: false,
      message: "user_id와 history_id는 필수입니다.",
    });
  }

  try {
    // 1) 해당 user + history 에 대한 3장(upper/lower/front) 조회
    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        history_id,
        image_type,           -- 'upper' | 'lower' | 'front'
        cloudinary_url,
        analyzed_image_url,
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
      [user_id, history_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 history_id에 대한 분석 결과가 없습니다.",
      });
    }

    // cavity_locations JSON 파싱
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
      image_type: r.image_type, // upper/lower/front
      cloudinary_url: r.cloudinary_url,
      analyzed_image_url: r.analyzed_image_url,
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

    // upper / lower / front 분리
    const upper = records.find((r) => r.image_type === "upper") || null;
    const lower = records.find((r) => r.image_type === "lower") || null;
    const front = records.find((r) => r.image_type === "front") || null;

    // 2) Gemini에 줄 프롬프트 작성
    const prompt = `
당신은 전문 치과의사 AI입니다.

아래는 한 사용자의 윗니(upper), 아랫니(lower), 앞니(front) 사진에 대한
AI 분석 결과(교합 상태, 충치 위치, 점수 등)입니다.
각 부위별로 **서로 다른 요약**을 작성해 주세요.

요구 사항:
1. upper / lower / front 각각에 대해
   - 2~3문장 정도의 한국어 요약을 작성합니다.
   - 내용은 교합 상태, 충치 개수/위치, 전반적 상태를 간단히 정리합니다.
2. 전체 구강 상태에 대한 종합 요약(overall_summary)도 3~4문장 정도로 작성합니다.
3. 말투는 정중한 한국어입니다.
4. 반드시 아래 JSON 형식만 출력하고, 마크다운(\`\`\`)이나 설명 문장은 넣지 마세요.

분석 원본 데이터(JSON):
${JSON.stringify(
  {
    user_id,
    history_id,
    records,
  },
  null,
  2
)}

출력 형식(JSON):

{
  "upper_summary": "윗니에 대한 2~3문장 요약 (없으면 빈 문자열)",
  "lower_summary": "아랫니에 대한 2~3문장 요약 (없으면 빈 문자열)",
  "front_summary": "앞니에 대한 2~3문장 요약 (없으면 빈 문자열)",
  "overall_summary": "전체 구강 상태 종합 요약 (3~4문장)"
}
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json", // JSON만 받도록 힌트
      },
    });

    const text = result.text || "";
    const summaryJson = parseGeminiJsonOrThrow(text, "image-analysis-summary");

    const {
      upper_summary = "",
      lower_summary = "",
      front_summary = "",
      overall_summary = "",
    } = summaryJson;

    // 3) DB 업데이트: 각 행의 llm_summary 채우기
    //    (ai_confidence, analyzed_at 은 여기서 건드리지 않고,
    //     필요하다면 analyzed_at 을 NOW()로 덮어쓸 수도 있음)
    const updateOne = async (image_type, summary) => {
      if (!summary || !summary.trim()) return;
      await pool.query(
        `
        UPDATE image_analysis
        SET llm_summary = ?,
            -- analyzed_at 이 NULL 이면 현재 시각으로 채움 (선택)
            analyzed_at = COALESCE(analyzed_at, CURRENT_TIMESTAMP)
        WHERE user_id = ?
          AND history_id = ?
          AND image_type = ?
        `,
        [summary.trim(), user_id, history_id, image_type]
      );
    };

    await updateOne("upper", upper_summary);
    await updateOne("lower", lower_summary);
    await updateOne("front", front_summary);

    // (원한다면 overall_summary 를 별도 컬럼에 넣거나,
    //  세 행 중 하나(예: front)에 넣는 것도 가능)

    return res.json({
      success: true,
      message: "LLM 요약이 성공적으로 생성 및 저장되었습니다.",
      data: {
        history_id,
        user_id,
        upper_summary,
        lower_summary,
        front_summary,
        overall_summary,
      },
    });
  } catch (error) {
    console.error("POST /api/ai/image-analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "구강 사진 LLM 요약 처리 중 오류가 발생했습니다.",
      error: IS_DEV ? error.message : undefined,
    });
  }
});

// -----------------------------------------------------
// 4) 구강 사진 분석 상세 조회 API
// GET /api/ai/image-analysis/history/:historyId?user_id=8
//   → DB에 이미 저장된 값(Flask 분석 + Gemini 요약)을 그대로 반환
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
        analyzed_image_url,
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
        ai_confidence,
        llm_summary
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

    // 2) cavity_locations / llm_summary JSON 파싱
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

    const parseSummary = (value) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch (e) {
        console.warn("llm_summary JSON parse error:", e);
        return value; // 원본 문자열 반환
      }
    };

    const records = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      history_id: r.history_id,
      image_type: r.image_type, // 'upper' | 'lower' | 'front'
      cloudinary_url: r.cloudinary_url,
      analyzed_image_url: r.analyzed_image_url,
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
      // 🔹 각 사진별 Gemini 요약 (upper/lower/front 각각 별도 내용)
      llm_summary: parseSummary(r.llm_summary),
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
