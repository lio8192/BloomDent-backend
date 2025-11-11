const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 기본 Hello API
router.get('/hello', (req, res) => {
  res.json({
    success: true,
    message: 'BloomDent API',
    timestamp: new Date().toISOString()
  });
});

// DB 연결 테스트를 포함한 Hello API
router.get('/hello-db', async (req, res) => {
  try {
    // 간단한 쿼리로 DB 연결 확인
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    
    res.json({
      success: true,
      message: 'Hello from BloomDent API with DB!',
      dbStatus: 'connected',
      dbTest: rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'DB 연결 오류',
      error: error.message
    });
  }
});

// 서버 상태 체크 API
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

module.exports = router;

