// routes/survey_detail.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * 1. 사용자별 설문 이력 목록 조회
 *    GET /api/survey-detail/history/:userId
 *
 *    - score_history 테이블에서 user_id 기준으로 정렬
 *    - 프론트에서는 created_at(YYYY-MM-DD), total_score 로 카드 리스트 구성
 */
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId가 필요합니다.',
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        total_score,
        oral_care_score,
        cavity_dryness_score,
        smoking_drinking_score,
        cariogenic_food_score,
        sensitivity_fluoride_score,
        oral_habits_score,
        score_type,
        survey_session_id,
        calculation_details,
        created_at
      FROM score_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('score_history 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '설문 이력 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

/**
 * 2. 특정 설문 세션 상세 조회
 *    GET /api/survey-detail/session/:sessionId
 *
 *    - score_history 에서 세션별 점수 요약
 *    - user_survey_responses + survey_questions + survey_question_options 조인해서
 *      질문 / 선택지 / 점수 / 카테고리 리스트 반환
 */
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId가 필요합니다.',
    });
  }

  const connection = await pool.getConnection();

  try {
    // 1) 세션 요약(점수) 정보
    const [summaryRows] = await connection.query(
      `
      SELECT
        id,
        user_id,
        total_score,
        oral_care_score,
        cavity_dryness_score,
        smoking_drinking_score,
        cariogenic_food_score,
        sensitivity_fluoride_score,
        oral_habits_score,
        score_type,
        survey_session_id,
        calculation_details,
        created_at
      FROM score_history
      WHERE survey_session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [sessionId]
    );

    if (summaryRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: '해당 세션의 점수 이력을 찾을 수 없습니다.',
      });
    }

    const summary = summaryRows[0];

    // 2) 세션별 질문/응답 상세
    const [detailRows] = await connection.query(
      `
      SELECT
        usr.question_number,
        sq.question_text,
        usr.option_number,
        sqo.option_text,
        usr.score,
        usr.category,
        usr.answered_at
      FROM user_survey_responses usr
      JOIN survey_questions sq
        ON usr.question_number = sq.question_number
      JOIN survey_question_options sqo
        ON usr.question_number = sqo.question_number
       AND usr.option_number   = sqo.option_number
      WHERE usr.survey_session_id = ?
      ORDER BY usr.question_number ASC, usr.option_number ASC
      `,
      [sessionId]
    );

    connection.release();

    return res.json({
      success: true,
      data: {
        summary,
        responses: detailRows,
      },
    });
  } catch (error) {
    connection.release();
    console.error('설문 세션 상세 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '설문 상세 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// GET /api/survey-detail/detail/:surveySessionId
router.get('/detail/:surveySessionId', async (req, res) => {
  const { surveySessionId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        user_id,
        survey_session_id,
        analysis_json,
        recommendations_json,
        model_name,
        created_at,
        updated_at
      FROM detail_survey
      WHERE survey_session_id = ?
      `,
      [surveySessionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 세션의 상세 설문 분석 결과를 찾을 수 없습니다.',
      });
    }

    const row = rows[0];

    // JSON 필드 파싱
    let analysis = null;
    let recommendations = [];

    try {
      if (row.analysis_json) {
        analysis = JSON.parse(row.analysis_json);
      }
    } catch (e) {
      console.error('analysis_json parse error:', e);
    }

    try {
      if (row.recommendations_json) {
        recommendations = JSON.parse(row.recommendations_json);
      }
    } catch (e) {
      console.error('recommendations_json parse error:', e);
    }

    return res.json({
      success: true,
      data: {
        id: row.id,
        user_id: row.user_id,
        survey_session_id: row.survey_session_id,
        model_name: row.model_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
        analysis,          // { summary, details, risk_factors, improvements }
        recommendations,   // [{ name, link, reason }, ...]
      },
    });
  } catch (error) {
    console.error('GET /survey-detail/detail error:', error);
    return res.status(500).json({
      success: false,
      message: '상세 설문 결과를 불러오는 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
module.exports = router;