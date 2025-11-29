const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * 카테고리 상수 (DB enum 기준)
 */
const CATEGORY = {
  ORAL_CARE: '구강관리/양치습관',
  BAD_BREATH: '구치/구강건조', // DB enum 기준
  SMOKING: '흡연/음주',
  CARIOGENIC_FOOD: '우식성 식품 섭취',
  SENSITIVITY: '지각과민/불소',
  ORAL_HABITS: '구강악습관',
};

/**
 * 1. 설문 시작 (1번 문항 조회)
 */
router.get('/start', async (req, res) => {
  try {
    const [questions] = await pool.query(
      `SELECT 
        question_number,
        question_text,
        max_score
       FROM survey_questions 
       WHERE question_number = 1 AND is_active = TRUE`
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '설문을 찾을 수 없습니다.',
      });
    }

    const [options] = await pool.query(
      `SELECT 
        option_number,
        option_text,
        next_question_number,
        score,
        category
       FROM survey_question_options 
       WHERE question_number = 1 
       ORDER BY option_number`
    );

    const [totalCount] = await pool.query(
      'SELECT COUNT(*) as total FROM survey_questions WHERE is_active = TRUE'
    );

    const sessionId = uuidv4();

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        current_question: questions[0],
        options,
        progress: {
          current: 1,
          total: totalCount[0].total,
          remaining: totalCount[0].total - 1,
        },
      },
    });
  } catch (error) {
    console.error('설문 시작 오류:', error);
    res.status(500).json({
      success: false,
      message: '설문 시작 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

/**
 * 2. 설문 응답 제출 및 다음 문항 조회
 * - user_survey_responses.score 에는 항상 리커트 원점수(1~5) 저장
 */
router.post('/answer', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { user_id, session_id, question_number, option_number } = req.body;

    if (!user_id || !session_id || !question_number || !option_number) {
      return res.status(400).json({
        success: false,
        message: '모든 필드는 필수입니다.',
      });
    }

    await connection.beginTransaction();

    const [selectedOption] = await connection.query(
      `SELECT 
        option_number,
        option_text,
        next_question_number,
        score,
        category
       FROM survey_question_options 
       WHERE question_number = ? AND option_number = ?`,
      [question_number, option_number]
    );

    if (selectedOption.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '선택한 응답을 찾을 수 없습니다.',
      });
    }

    const option = selectedOption[0];

    // score = 리커트 원점수 (1~5)
    await connection.query(
      `INSERT INTO user_survey_responses 
       (user_id, survey_session_id, question_number, option_number, score, category) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        session_id,
        question_number,
        option_number,
        option.score,
        option.category,
      ]
    );

    await connection.commit();

    const [totalCount] = await connection.query(
      'SELECT COUNT(*) as total FROM survey_questions WHERE is_active = TRUE'
    );

    const [answeredCount] = await connection.query(
      'SELECT COUNT(*) as count FROM user_survey_responses WHERE survey_session_id = ?',
      [session_id]
    );

    const currentProgress = answeredCount[0].count;
    const totalQuestions = totalCount[0].total;
    const remaining = totalQuestions - currentProgress;

    // 다음 문항이 없으면 설문 완료
    if (!option.next_question_number) {
      return res.json({
        success: true,
        data: {
          session_id,
          answered_option: {
            option_number: option.option_number,
            option_text: option.option_text,
            score: option.score,
            category: option.category,
          },
          is_completed: true,
          progress: {
            current: currentProgress,
            total: totalQuestions,
            remaining: 0,
          },
          message:
            '설문이 완료되었습니다. /api/survey/calculate를 호출하여 점수를 계산하세요.',
        },
      });
    }

    // 다음 문항 조회
    const [nextQuestions] = await connection.query(
      `SELECT 
        question_number,
        question_text,
        max_score
       FROM survey_questions 
       WHERE question_number = ? AND is_active = TRUE`,
      [option.next_question_number]
    );

    if (nextQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '다음 문항을 찾을 수 없습니다.',
      });
    }

    const [nextOptions] = await connection.query(
      `SELECT 
        option_number,
        option_text,
        next_question_number,
        score,
        category
       FROM survey_question_options 
       WHERE question_number = ? 
       ORDER BY option_number`,
      [option.next_question_number]
    );

    res.json({
      success: true,
      data: {
        session_id,
        answered_option: {
          option_number: option.option_number,
          option_text: option.option_text,
          score: option.score,
          category: option.category,
        },
        next_question: nextQuestions[0],
        options: nextOptions,
        is_completed: false,
        progress: {
          current: currentProgress,
          total: totalQuestions,
          remaining,
        },
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('설문 응답 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '설문 응답 처리 중 오류가 발생했습니다.',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

/**
 * 3. 설문 결과로 점수 계산 및 저장 (max_score 완전 무시 버전)
 * - 각 응답 score(1~5)만 사용
 * - 카테고리:
 *     earned_cat = 해당 카테고리 score 합
 *     max_cat    = 문항 수 × 5
 *     score_cat  = (earned_cat / max_cat) × 100
 * - 전체:
 *     totalEarned = 모든 score 합
 *     totalMax    = 전체 문항 수 × 5
 *     totalScore  = (totalEarned / totalMax) × 100
 */
router.post('/calculate', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { user_id, session_id } = req.body;

    if (!user_id || !session_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 session_id는 필수입니다.',
      });
    }

    await connection.beginTransaction();

    // 현재 세션의 모든 응답(리커트 1~5, 카테고리) 조회
    const [responses] = await connection.query(
      `SELECT 
        usr.category,
        usr.score AS raw_score
       FROM user_survey_responses usr
       WHERE usr.user_id = ? 
         AND usr.survey_session_id = ?`,
      [user_id, session_id]
    );

    if (responses.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '설문 응답을 찾을 수 없습니다.',
      });
    }

    const baseCategories = [
      CATEGORY.ORAL_CARE,
      CATEGORY.BAD_BREATH,
      CATEGORY.SMOKING,
      CATEGORY.CARIOGENIC_FOOD,
      CATEGORY.SENSITIVITY,
      CATEGORY.ORAL_HABITS,
    ];

    // 카테고리별 합계 관리
    const categoryData = {};
    baseCategories.forEach((cat) => {
      categoryData[cat] = { sumScore: 0, count: 0 };
    });

    let totalEarned = 0;
    let totalCount = 0;

    responses.forEach((row) => {
      const raw = Number(row.raw_score) || 0; // 1~5

      let categoryKey = row.category;
      if (categoryKey === '구취/구강건조') {
        categoryKey = CATEGORY.BAD_BREATH;
      }

      if (!categoryData[categoryKey]) {
        categoryData[categoryKey] = { sumScore: 0, count: 0 };
      }

      categoryData[categoryKey].sumScore += raw;
      categoryData[categoryKey].count += 1;

      totalEarned += raw;
      totalCount += 1;
    });

    // 카테고리별 0~100 점수
    const categoryScores = {};
    baseCategories.forEach((cat) => {
      const { sumScore, count } = categoryData[cat] || { sumScore: 0, count: 0 };
      const maxCat = count * 5;
      categoryScores[cat] = maxCat > 0 ? (sumScore / maxCat) * 100 : 0;
    });

    // 전체 0~100 점수
    const totalMax = totalCount * 5;
    const totalScore = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

    // 기존 점수 존재 여부 확인
    const [existing] = await connection.query(
      'SELECT id FROM user_health_scores WHERE user_id = ?',
      [user_id]
    );

    if (existing.length > 0) {
      await connection.query(
        `UPDATE user_health_scores 
         SET total_score = ?,
             oral_care_score = ?,
             cavity_dryness_score = ?,
             smoking_drinking_score = ?,
             cariogenic_food_score = ?,
             sensitivity_fluoride_score = ?,
             oral_habits_score = ?,
             last_survey_session_id = ?,
             last_survey_date = NOW(),
             updated_at = NOW()
         WHERE user_id = ?`,
        [
          totalScore,
          categoryScores[CATEGORY.ORAL_CARE],
          categoryScores[CATEGORY.BAD_BREATH],
          categoryScores[CATEGORY.SMOKING],
          categoryScores[CATEGORY.CARIOGENIC_FOOD],
          categoryScores[CATEGORY.SENSITIVITY],
          categoryScores[CATEGORY.ORAL_HABITS],
          session_id,
          user_id,
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO user_health_scores 
         (user_id, total_score, oral_care_score, cavity_dryness_score,
          smoking_drinking_score, cariogenic_food_score, sensitivity_fluoride_score,
          oral_habits_score, last_survey_session_id, last_survey_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          user_id,
          totalScore,
          categoryScores[CATEGORY.ORAL_CARE],
          categoryScores[CATEGORY.BAD_BREATH],
          categoryScores[CATEGORY.SMOKING],
          categoryScores[CATEGORY.CARIOGENIC_FOOD],
          categoryScores[CATEGORY.SENSITIVITY],
          categoryScores[CATEGORY.ORAL_HABITS],
          session_id,
        ]
      );
    }

    // 이력 저장
    await connection.query(
      `INSERT INTO score_history 
       (user_id, total_score, oral_care_score, cavity_dryness_score,
        smoking_drinking_score, cariogenic_food_score, sensitivity_fluoride_score,
        oral_habits_score, score_type, survey_session_id, calculation_details) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'survey', ?, ?)`,
      [
        user_id,
        totalScore,
        categoryScores[CATEGORY.ORAL_CARE],
        categoryScores[CATEGORY.BAD_BREATH],
        categoryScores[CATEGORY.SMOKING],
        categoryScores[CATEGORY.CARIOGENIC_FOOD],
        categoryScores[CATEGORY.SENSITIVITY],
        categoryScores[CATEGORY.ORAL_HABITS],
        session_id,
        JSON.stringify({
          session_id,
          calculated_at: new Date().toISOString(),
          totalEarned,
          totalMax,
        }),
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: '점수가 계산되어 저장되었습니다.',
      data: {
        total_score: Number(totalScore.toFixed(2)),
        categories: {
          [CATEGORY.ORAL_CARE]: Number(
            categoryScores[CATEGORY.ORAL_CARE].toFixed(2)
          ),
          [CATEGORY.BAD_BREATH]: Number(
            categoryScores[CATEGORY.BAD_BREATH].toFixed(2)
          ),
          [CATEGORY.SMOKING]: Number(
            categoryScores[CATEGORY.SMOKING].toFixed(2)
          ),
          [CATEGORY.CARIOGENIC_FOOD]: Number(
            categoryScores[CATEGORY.CARIOGENIC_FOOD].toFixed(2)
          ),
          [CATEGORY.SENSITIVITY]: Number(
            categoryScores[CATEGORY.SENSITIVITY].toFixed(2)
          ),
          [CATEGORY.ORAL_HABITS]: Number(
            categoryScores[CATEGORY.ORAL_HABITS].toFixed(2)
          ),
        },
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('점수 계산 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 계산 중 오류가 발생했습니다.',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

/**
 * 4. 사용자의 설문 응답 이력 조회
 */
router.get('/responses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { session_id } = req.query;

    let query = `
      SELECT 
        usr.id,
        usr.survey_session_id,
        usr.question_number,
        sq.question_text,
        usr.option_number,
        sqo.option_text,
        usr.score,
        usr.category,
        usr.answered_at
      FROM user_survey_responses usr
      JOIN survey_questions sq ON usr.question_number = sq.question_number
      JOIN survey_question_options sqo 
        ON usr.question_number = sqo.question_number 
       AND usr.option_number   = sqo.option_number
      WHERE usr.user_id = ?
    `;

    const params = [userId];

    if (session_id) {
      query += ' AND usr.survey_session_id = ?';
      params.push(session_id);
    }

    query += ' ORDER BY usr.answered_at DESC';

    const [responses] = await pool.query(query, params);

    res.json({
      success: true,
      count: responses.length,
      data: responses,
    });
  } catch (error) {
    console.error('응답 이력 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '응답 이력 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

/**
 * 5. 특정 문항 조회 (관리자용)
 */
router.get('/questions/:questionNumber', async (req, res) => {
  try {
    const { questionNumber } = req.params;

    const [questions] = await pool.query(
      `SELECT * FROM survey_questions WHERE question_number = ?`,
      [questionNumber]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '문항을 찾을 수 없습니다.',
      });
    }

    const [options] = await pool.query(
      `SELECT * FROM survey_question_options 
        WHERE question_number = ? 
        ORDER BY option_number`,
      [questionNumber]
    );

    res.json({
      success: true,
      data: {
        question: questions[0],
        options,
      },
    });
  } catch (error) {
    console.error('문항 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '문항 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;