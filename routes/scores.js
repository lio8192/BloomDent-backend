const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 카테고리 정의
const CATEGORIES = [
  '구강관리/양치습관',
  '구치/구강건조',
  '흡연/음주',
  '우식성 식품 섭취',
  '지각과민/불소',
  '구강악습관'
];

// 사용자 점수 조회
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 사용자 확인
    const [users] = await pool.query(
      'SELECT id, name FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 점수 조회
    const [scores] = await pool.query(
      'SELECT * FROM user_health_scores WHERE user_id = ?',
      [userId]
    );

    // 점수가 없으면 초기값 생성
    if (scores.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO user_health_scores (user_id) VALUES (?)',
        [userId]
      );

      return res.json({
        success: true,
        data: {
          user_id: parseInt(userId),
          user_name: users[0].name,
          total_score: 0,
          categories: {
            '구강관리/양치습관': 0,
            '구치/구강건조': 0,
            '흡연/음주': 0,
            '우식성 식품 섭취': 0,
            '지각과민/불소': 0,
            '구강악습관': 0
          },
          last_survey_date: null,
          is_new: true
        }
      });
    }

    const score = scores[0];

    res.json({
      success: true,
      data: {
        id: score.id,
        user_id: score.user_id,
        user_name: users[0].name,
        total_score: score.total_score,
        categories: {
          '구강관리/양치습관': score.oral_care_score,
          '구치/구강건조': score.cavity_dryness_score,
          '흡연/음주': score.smoking_drinking_score,
          '우식성 식품 섭취': score.cariogenic_food_score,
          '지각과민/불소': score.sensitivity_fluoride_score,
          '구강악습관': score.oral_habits_score
        },
        last_survey_session_id: score.last_survey_session_id,
        last_survey_date: score.last_survey_date,
        updated_at: score.updated_at
      }
    });

  } catch (error) {
    console.error('점수 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 점수 입력/수정
router.post('/user/:userId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;
    const { category_scores, session_id } = req.body;

    if (!category_scores) {
      return res.status(400).json({
        success: false,
        message: 'category_scores는 필수입니다.'
      });
    }

    await connection.beginTransaction();

    // 사용자 확인
    const [users] = await connection.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 카테고리 점수 추출
    const oralCare = category_scores['구강관리/양치습관'] || 0;
    const cavityDryness = category_scores['구치/구강건조'] || 0;
    const smokingDrinking = category_scores['흡연/음주'] || 0;
    const cariogenicFood = category_scores['우식성 식품 섭취'] || 0;
    const sensitivityFluoride = category_scores['지각과민/불소'] || 0;
    const oralHabits = category_scores['구강악습관'] || 0;

    // 총점 계산
    const totalScore = (
      parseFloat(oralCare) +
      parseFloat(cavityDryness) +
      parseFloat(smokingDrinking) +
      parseFloat(cariogenicFood) +
      parseFloat(sensitivityFluoride) +
      parseFloat(oralHabits)
    ) / 6;

    // 기존 점수 확인
    const [existing] = await connection.query(
      'SELECT id FROM user_health_scores WHERE user_id = ?',
      [userId]
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
          oralCare,
          cavityDryness,
          smokingDrinking,
          cariogenicFood,
          sensitivityFluoride,
          oralHabits,
          session_id || null,
          userId
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
          userId,
          totalScore,
          oralCare,
          cavityDryness,
          smokingDrinking,
          cariogenicFood,
          sensitivityFluoride,
          oralHabits,
          session_id || null
        ]
      );
    }

    // 이력 저장
    await connection.query(
      `INSERT INTO score_history 
       (user_id, total_score, oral_care_score, cavity_dryness_score,
        smoking_drinking_score, cariogenic_food_score, sensitivity_fluoride_score,
        oral_habits_score, score_type, survey_session_id, calculation_details) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
      [
        userId,
        totalScore,
        oralCare,
        cavityDryness,
        smokingDrinking,
        cariogenicFood,
        sensitivityFluoride,
        oralHabits,
        session_id || null,
        JSON.stringify({
          updated_at: new Date().toISOString()
        })
      ]
    );

    await connection.commit();

    // 업데이트된 점수 조회
    const [updatedScore] = await connection.query(
      'SELECT * FROM user_health_scores WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: '점수가 저장되었습니다.',
      data: {
        total_score: updatedScore[0].total_score,
        categories: {
          '구강관리/양치습관': updatedScore[0].oral_care_score,
          '구치/구강건조': updatedScore[0].cavity_dryness_score,
          '흡연/음주': updatedScore[0].smoking_drinking_score,
          '우식성 식품 섭취': updatedScore[0].cariogenic_food_score,
          '지각과민/불소': updatedScore[0].sensitivity_fluoride_score,
          '구강악습관': updatedScore[0].oral_habits_score
        }
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('점수 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 점수 삭제 (초기화)
router.delete('/user/:userId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;

    await connection.beginTransaction();

    // 점수 존재 확인
    const [existing] = await connection.query(
      'SELECT id FROM user_health_scores WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '삭제할 점수가 없습니다.'
      });
    }

    // 점수 초기화
    await connection.query(
      `UPDATE user_health_scores 
       SET total_score = 0,
           oral_care_score = 0,
           cavity_dryness_score = 0,
           smoking_drinking_score = 0,
           cariogenic_food_score = 0,
           sensitivity_fluoride_score = 0,
           oral_habits_score = 0,
           last_survey_session_id = NULL,
           last_survey_date = NULL,
           updated_at = NOW()
       WHERE user_id = ?`,
      [userId]
    );

    // 이력 저장
    await connection.query(
      `INSERT INTO score_history 
       (user_id, total_score, oral_care_score, cavity_dryness_score,
        smoking_drinking_score, cariogenic_food_score, sensitivity_fluoride_score,
        oral_habits_score, score_type, calculation_details) 
       VALUES (?, 0, 0, 0, 0, 0, 0, 0, 'initial', ?)`,
      [
        userId,
        JSON.stringify({
          action: 'reset',
          reset_at: new Date().toISOString()
        })
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: '점수가 초기화되었습니다.'
    });

  } catch (error) {
    await connection.rollback();
    console.error('점수 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 점수 이력 조회
router.get('/user/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const [history] = await pool.query(
      `SELECT 
        id,
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
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM score_history WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        user_id: parseInt(userId),
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        history: history
      }
    });

  } catch (error) {
    console.error('이력 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '이력 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 리더보드 조회
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [leaderboard] = await pool.query(
      `SELECT 
        uhs.user_id,
        u.name as user_name,
        uhs.total_score,
        uhs.last_survey_date,
        uhs.updated_at
       FROM user_health_scores uhs
       JOIN users u ON uhs.user_id = u.id
       WHERE uhs.total_score > 0
       ORDER BY uhs.total_score DESC
       LIMIT ?`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      data: leaderboard
    });

  } catch (error) {
    console.error('리더보드 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '리더보드 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 카테고리 목록 조회
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: CATEGORIES
    }
  });
});

// 꺽은선 그래프용 점수 이력 조회
router.get('/user/:userId/chart', async (req, res) => {
  try {
    const { userId } = req.params;

    // 사용자 확인
    const [users] = await pool.query(
      'SELECT id, name FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // score_history에서 total_score와 created_at 조회 (시간순 오름차순)
    const [history] = await pool.query(
      `SELECT 
        total_score,
        created_at
       FROM score_history 
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId]
    );

    // 그래프용 데이터 포맷팅
    const chartData = history.map(item => {
      const date = new Date(item.created_at);
      return {
        date: date.toISOString().split('T')[0], // YYYY-MM-DD 형식
        total_score: parseFloat(item.total_score),
        timestamp: date.toISOString() // 전체 타임스탬프
      };
    });

    res.json({
      success: true,
      data: {
        user_id: parseInt(userId),
        user_name: users[0].name,
        chart_data: chartData,
        count: chartData.length
      }
    });

  } catch (error) {
    console.error('그래프 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '그래프 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
