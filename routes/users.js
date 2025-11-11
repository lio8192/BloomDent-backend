const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 필수 필드 검증
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요.'
      });
    }

    // 사용자 조회
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 일치하지 않습니다.'
      });
    }

    const user = users[0];

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 일치하지 않습니다.'
      });
    }

    // 비밀번호 제외하고 응답
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        user: userWithoutPassword
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 정보 조회 (ID로)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(
      'SELECT id, username, name, phone, email, created_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자의 예약 목록 조회
router.get('/:id/appointments', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query; // 상태 필터 (optional)

    let query = `
      SELECT 
        a.*,
        dc.name as clinic_name,
        dc.address as clinic_address,
        dc.phone as clinic_phone,
        s.date as appointment_date,
        s.time_slot as appointment_time
      FROM appointments a
      JOIN dental_clinics dc ON a.clinic_id = dc.id
      JOIN appointment_slots s ON a.slot_id = s.id
      WHERE a.user_id = ?
    `;

    const params = [id];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.date DESC, s.time_slot DESC';

    const [appointments] = await pool.query(query, params);

    res.json({
      success: true,
      count: appointments.length,
      data: appointments
    });

  } catch (error) {
    console.error('예약 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

