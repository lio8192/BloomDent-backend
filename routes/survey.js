const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// 설문 시작 (1번 문항 조회)
router.get('/start', async (req, res) => {
  try {
    // 1번 문항 조회
    const [questions] = await pool.query(
      `SELECT 
        question_number,
        question_text,
        max_score
       FROM survey_questions_master 
       WHERE question_number = 1 AND is_active = TRUE`
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '설문을 찾을 수 없습니다.'
      });
    }

    // 1번 문항의 응답 옵션 조회
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

    // 전체 설문 수 조회
    const [totalCount] = await pool.query(
      'SELECT COUNT(*) as total FROM survey_questions_master WHERE is_active = TRUE'
    );

    // 새 설문 세션 ID 생성
    const sessionId = uuidv4();

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        current_question: questions[0],
        options: options,
        progress: {
          current: 1,
          total: totalCount[0].total,
          remaining: totalCount[0].total - 1
        }
      }
    });

  } catch (error) {
    console.error('설문 시작 오류:', error);
    res.status(500).json({
      success: false,
      message: '설문 시작 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 설문 응답 제출 및 다음 문항 조회
router.post('/answer', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      user_id,
      session_id,
      question_number,
      option_number
    } = req.body;

    // 필수 필드 검증
    if (!user_id || !session_id || !question_number || !option_number) {
      return res.status(400).json({
        success: false,
        message: '모든 필드는 필수입니다.'
      });
    }

    await connection.beginTransaction();

    // 선택한 옵션 정보 조회
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
        message: '선택한 응답을 찾을 수 없습니다.'
      });
    }

    const option = selectedOption[0];

    // 응답 저장
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
        option.category
      ]
    );

    await connection.commit();

    // 전체 설문 수 조회
    const [totalCount] = await connection.query(
      'SELECT COUNT(*) as total FROM survey_questions_master WHERE is_active = TRUE'
    );

    // 현재까지 답변한 수 조회
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
          session_id: session_id,
          answered_option: {
            option_number: option.option_number,
            option_text: option.option_text,
            score: option.score,
            category: option.category
          },
          is_completed: true,
          progress: {
            current: currentProgress,
            total: totalQuestions,
            remaining: 0
          },
          message: '설문이 완료되었습니다. /api/survey/calculate를 호출하여 점수를 계산하세요.'
        }
      });
    }

    // 다음 문항 조회
    const [nextQuestions] = await connection.query(
      `SELECT 
        question_number,
        question_text,
        max_score
       FROM survey_questions_master 
       WHERE question_number = ? AND is_active = TRUE`,
      [option.next_question_number]
    );

    if (nextQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '다음 문항을 찾을 수 없습니다.'
      });
    }

    // 다음 문항의 응답 옵션 조회
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
        session_id: session_id,
        answered_option: {
          option_number: option.option_number,
          option_text: option.option_text,
          score: option.score,
          category: option.category
        },
        next_question: nextQuestions[0],
        options: nextOptions,
        is_completed: false,
        progress: {
          current: currentProgress,
          total: totalQuestions,
          remaining: remaining
        }
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('설문 응답 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '설문 응답 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 설문 결과로 점수 계산 및 저장
router.post('/calculate', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { user_id, session_id } = req.body;

    if (!user_id || !session_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id와 session_id는 필수입니다.'
      });
    }

    await connection.beginTransaction();

    // 설문 응답과 각 문항의 최대 점수 조회
    const [responses] = await connection.query(
      `SELECT 
        usr.category,
        usr.score as earned_score,
        sqm.max_score
       FROM user_survey_responses usr
       JOIN survey_questions_master sqm ON usr.question_number = sqm.question_number
       WHERE usr.user_id = ? AND usr.survey_session_id = ?`,
      [user_id, session_id]
    );

    if (responses.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '설문 응답을 찾을 수 없습니다.'
      });
    }

    // 카테고리별 획득 점수와 최대 점수 집계
    const categoryData = {
      '구강관리/양치습관': { earned: 0, max: 0 },
      '구치/구강건조': { earned: 0, max: 0 },
      '흡연/음주': { earned: 0, max: 0 },
      '우식성 식품 섭취': { earned: 0, max: 0 },
      '지각과민/불소': { earned: 0, max: 0 },
      '구강악습관': { earned: 0, max: 0 }
    };

    let totalEarned = 0;
    let totalMax = 0;

    responses.forEach(row => {
      const earned = parseFloat(row.earned_score);
      const max = parseFloat(row.max_score);
      
      categoryData[row.category].earned += earned;
      categoryData[row.category].max += max;
      
      totalEarned += earned;
      totalMax += max;
    });

    // 카테고리별 표준화 점수 계산 (획득/최대 × 100)
    const categoryScores = {};
    Object.keys(categoryData).forEach(category => {
      const { earned, max } = categoryData[category];
      if (max > 0) {
        categoryScores[category] = (earned / max) * 100;
      } else {
        categoryScores[category] = 0;
      }
    });

    // 총점 계산 (전체 획득/전체 최대 × 100)
    const totalScore = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

    // 기존 점수 확인
    const [existing] = await connection.query(
      'SELECT id FROM user_health_scores WHERE user_id = ?',
      [user_id]
    );

    if (existing.length > 0) {
      // 업데이트
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
          categoryScores['구강관리/양치습관'],
          categoryScores['구치/구강건조'],
          categoryScores['흡연/음주'],
          categoryScores['우식성 식품 섭취'],
          categoryScores['지각과민/불소'],
          categoryScores['구강악습관'],
          session_id,
          user_id
        ]
      );
    } else {
      // 생성
      await connection.query(
        `INSERT INTO user_health_scores 
         (user_id, total_score, oral_care_score, cavity_dryness_score,
          smoking_drinking_score, cariogenic_food_score, sensitivity_fluoride_score,
          oral_habits_score, last_survey_session_id, last_survey_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          user_id,
          totalScore,
          categoryScores['구강관리/양치습관'],
          categoryScores['구치/구강건조'],
          categoryScores['흡연/음주'],
          categoryScores['우식성 식품 섭취'],
          categoryScores['지각과민/불소'],
          categoryScores['구강악습관'],
          session_id
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
        categoryScores['구강관리/양치습관'],
        categoryScores['구치/구강건조'],
        categoryScores['흡연/음주'],
        categoryScores['우식성 식품 섭취'],
        categoryScores['지각과민/불소'],
        categoryScores['구강악습관'],
        session_id,
        JSON.stringify({
          session_id: session_id,
          calculated_at: new Date().toISOString()
        })
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: '점수가 계산되어 저장되었습니다.',
      data: {
        total_score: parseFloat(totalScore.toFixed(2)),
        categories: {
          '구강관리/양치습관': parseFloat(categoryScores['구강관리/양치습관'].toFixed(2)),
          '구치/구강건조': parseFloat(categoryScores['구치/구강건조'].toFixed(2)),
          '흡연/음주': parseFloat(categoryScores['흡연/음주'].toFixed(2)),
          '우식성 식품 섭취': parseFloat(categoryScores['우식성 식품 섭취'].toFixed(2)),
          '지각과민/불소': parseFloat(categoryScores['지각과민/불소'].toFixed(2)),
          '구강악습관': parseFloat(categoryScores['구강악습관'].toFixed(2))
        },
        calculation_details: {
          total_earned: totalEarned,
          total_max: totalMax,
          formula: '(획득 점수 / 최대 점수) × 100'
        }
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('점수 계산 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 계산 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 사용자의 설문 응답 이력 조회
router.get('/responses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { session_id } = req.query;

    let query = `
      SELECT 
        usr.id,
        usr.survey_session_id,
        usr.question_number,
        sqm.question_text,
        usr.option_number,
        sqo.option_text,
        usr.score,
        usr.category,
        usr.answered_at
      FROM user_survey_responses usr
      JOIN survey_questions_master sqm ON usr.question_number = sqm.question_number
      JOIN survey_question_options sqo ON usr.question_number = sqo.question_number 
        AND usr.option_number = sqo.option_number
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
      data: responses
    });

  } catch (error) {
    console.error('응답 이력 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '응답 이력 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 문항 조회 (관리자용)
router.get('/questions/:questionNumber', async (req, res) => {
  try {
    const { questionNumber } = req.params;

    const [questions] = await pool.query(
      `SELECT * FROM survey_questions_master WHERE question_number = ?`,
      [questionNumber]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '문항을 찾을 수 없습니다.'
      });
    }

    const [options] = await pool.query(
      `SELECT * FROM survey_question_options WHERE question_number = ? ORDER BY option_number`,
      [questionNumber]
    );

    res.json({
      success: true,
      data: {
        question: questions[0],
        options: options
      }
    });

  } catch (error) {
    console.error('문항 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '문항 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

