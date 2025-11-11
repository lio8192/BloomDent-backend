const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 사용자 종합 점수 조회
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

    // 종합 점수 조회
    const [scores] = await pool.query(
      `SELECT 
        id,
        user_id,
        overall_score,
        analysis_score,
        survey_score,
        image_count,
        survey_count,
        last_analysis_date,
        last_calculated_at,
        updated_at
       FROM user_health_scores 
       WHERE user_id = ?`,
      [userId]
    );

    // 점수가 없으면 초기값 생성
    if (scores.length === 0) {
      const [result] = await pool.query(
        `INSERT INTO user_health_scores (user_id) VALUES (?)`,
        [userId]
      );

      return res.json({
        success: true,
        data: {
          user_id: parseInt(userId),
          user_name: users[0].name,
          overall_score: 0,
          analysis_score: 0,
          survey_score: 0,
          image_count: 0,
          survey_count: 0,
          last_analysis_date: null,
          last_calculated_at: new Date(),
          is_new: true
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...scores[0],
        user_name: users[0].name
      }
    });

  } catch (error) {
    console.error('종합 점수 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '종합 점수 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 종합 점수 계산/업데이트
router.post('/calculate/:userId', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { userId } = req.params;
    const { 
      overall_score, 
      analysis_score, 
      survey_score,
      calculation_details 
    } = req.body;

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

    // 현재 통계 조회
    const [imageStats] = await connection.query(
      `SELECT COUNT(*) as count, MAX(uploaded_at) as last_date
       FROM dental_images 
       WHERE user_id = ? AND analysis_status = 'completed'`,
      [userId]
    );

    const [surveyStats] = await connection.query(
      `SELECT COUNT(DISTINCT a.id) as count
       FROM appointments a
       JOIN appointment_surveys aps ON a.id = aps.appointment_id
       WHERE a.user_id = ?`,
      [userId]
    );

    const imageCount = imageStats[0].count || 0;
    const surveyCount = surveyStats[0].count || 0;
    const lastAnalysisDate = imageStats[0].last_date 
      ? new Date(imageStats[0].last_date).toISOString().split('T')[0] 
      : null;

    // 점수 업데이트 또는 생성
    const [existing] = await connection.query(
      'SELECT id FROM user_health_scores WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // 업데이트
      await connection.query(
        `UPDATE user_health_scores 
         SET overall_score = ?, 
             analysis_score = ?, 
             survey_score = ?,
             image_count = ?,
             survey_count = ?,
             last_analysis_date = ?,
             last_calculated_at = NOW(),
             updated_at = NOW()
         WHERE user_id = ?`,
        [
          overall_score || 0,
          analysis_score || 0,
          survey_score || 0,
          imageCount,
          surveyCount,
          lastAnalysisDate,
          userId
        ]
      );
    } else {
      // 생성
      await connection.query(
        `INSERT INTO user_health_scores 
         (user_id, overall_score, analysis_score, survey_score, 
          image_count, survey_count, last_analysis_date, last_calculated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          overall_score || 0,
          analysis_score || 0,
          survey_score || 0,
          imageCount,
          surveyCount,
          lastAnalysisDate
        ]
      );
    }

    // 이력 저장
    await connection.query(
      `INSERT INTO score_history 
       (user_id, overall_score, analysis_score, survey_score, 
        score_type, calculation_details) 
       VALUES (?, ?, ?, ?, 'auto', ?)`,
      [
        userId,
        overall_score || 0,
        analysis_score || 0,
        survey_score || 0,
        JSON.stringify(calculation_details || {
          image_count: imageCount,
          survey_count: surveyCount,
          calculated_at: new Date().toISOString()
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
      message: '종합 점수가 업데이트되었습니다.',
      data: updatedScore[0]
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

// 점수 이력 조회
router.get('/user/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    // 사용자 확인
    const [users] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 이력 조회
    const [history] = await pool.query(
      `SELECT 
        id,
        overall_score,
        analysis_score,
        survey_score,
        score_type,
        calculation_details,
        calculated_at
       FROM score_history 
       WHERE user_id = ?
       ORDER BY calculated_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // 전체 개수 조회
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
    console.error('점수 이력 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '점수 이력 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 점수 통계 조회 (대시보드용)
router.get('/user/:userId/statistics', async (req, res) => {
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

    // 현재 점수
    const [currentScore] = await pool.query(
      'SELECT * FROM user_health_scores WHERE user_id = ?',
      [userId]
    );

    // 최근 30일 점수 변화
    const [recentHistory] = await pool.query(
      `SELECT 
        overall_score,
        calculated_at
       FROM score_history 
       WHERE user_id = ? 
         AND calculated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY calculated_at ASC`,
      [userId]
    );

    // 분석 완료된 이미지 수
    const [imageCount] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM dental_images 
       WHERE user_id = ? AND analysis_status = 'completed'`,
      [userId]
    );

    // 최근 분석 결과
    const [recentAnalysis] = await pool.query(
      `SELECT 
        di.id,
        di.cloudinary_url,
        di.uploaded_at,
        ia.overall_score,
        ia.cavity_detected
       FROM dental_images di
       LEFT JOIN image_analysis ia ON di.id = ia.image_id
       WHERE di.user_id = ? AND di.analysis_status = 'completed'
       ORDER BY di.uploaded_at DESC
       LIMIT 5`,
      [userId]
    );

    // 평균 분석 점수
    const [avgAnalysisScore] = await pool.query(
      `SELECT AVG(ia.overall_score) as avg_score
       FROM dental_images di
       JOIN image_analysis ia ON di.id = ia.image_id
       WHERE di.user_id = ? AND di.analysis_status = 'completed'`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        user_id: parseInt(userId),
        user_name: users[0].name,
        current_score: currentScore.length > 0 ? currentScore[0] : null,
        statistics: {
          total_images: imageCount[0].count,
          avg_analysis_score: avgAnalysisScore[0].avg_score || 0,
          score_trend: recentHistory,
          recent_analysis: recentAnalysis
        }
      }
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전체 사용자 순위 조회 (리더보드)
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const [leaderboard] = await pool.query(
      `SELECT 
        uhs.user_id,
        u.name as user_name,
        uhs.overall_score,
        uhs.image_count,
        uhs.survey_count,
        uhs.last_calculated_at
       FROM user_health_scores uhs
       JOIN users u ON uhs.user_id = u.id
       WHERE uhs.overall_score > 0
       ORDER BY uhs.overall_score DESC
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

module.exports = router;

