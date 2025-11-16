const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

// 설문 답변 검증 함수
const validateSurveyAnswers = (surveyAnswers) => {
  // 필수 키 목록
  const requiredKeys = [
    'visitedDentist',
    'brushTwiceDaily',
    'useOralCareProducts',
    'replaceToothbrush',
    'limitSweets',
    'brushAfterMeal',
    'scalingFluoride',
    'noGumBleeding',
    'noSmoking'
  ];

  // surveyAnswers가 객체인지 확인
  if (!surveyAnswers || typeof surveyAnswers !== 'object') {
    return { valid: false, message: '설문 답변은 객체 형식이어야 합니다.' };
  }

  // 모든 필수 키가 존재하는지 확인
  for (const key of requiredKeys) {
    if (!(key in surveyAnswers)) {
      return { valid: false, message: `필수 설문 항목 '${key}'가 누락되었습니다.` };
    }
    
    // 각 값이 boolean인지 확인
    if (typeof surveyAnswers[key] !== 'boolean') {
      return { valid: false, message: `'${key}'는 boolean 값이어야 합니다.` };
    }
  }

  return { valid: true };
};

// 아이디 중복 체크
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;

    // username 파라미터 검증
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '아이디를 입력해주세요.'
      });
    }

    // username 중복 확인
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    const isAvailable = existingUsers.length === 0;

    res.json({
      success: true,
      available: isAvailable,
      message: isAvailable 
        ? '사용 가능한 아이디입니다.' 
        : '이미 사용 중인 아이디입니다.'
    });

  } catch (error) {
    console.error('아이디 중복 체크 오류:', error);
    res.status(500).json({
      success: false,
      message: '아이디 중복 체크 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 회원가입
router.post('/register', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { username, password, name, phone, email, surveyAnswers } = req.body;

    // 필수 필드 검증
    if (!username || !password || !name) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: '아이디, 비밀번호, 이름은 필수입니다.'
      });
    }

    // 설문 답변 검증 (있는 경우)
    if (surveyAnswers) {
      const validation = validateSurveyAnswers(surveyAnswers);
      if (!validation.valid) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }
    }

    await connection.beginTransaction();

    // username 중복 확인
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 아이디입니다.'
      });
    }

    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const [result] = await connection.query(
      'INSERT INTO users (username, password, name, phone, email) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, name, phone || null, email || null]
    );

    const userId = result.insertId;

    // 설문 답변이 있으면 self_check 테이블에 저장
    if (surveyAnswers) {
      await connection.query(
        'INSERT INTO self_check (user_id, answers) VALUES (?, ?)',
        [userId, JSON.stringify(surveyAnswers)]
      );
    }

    await connection.commit();

    // 생성된 사용자 정보 조회 (비밀번호 제외)
    const [newUsers] = await connection.query(
      'SELECT id, username, name, phone, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        user: newUsers[0]
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('회원가입 오류:', error);
    
    // MySQL 에러 코드 처리
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 아이디입니다.'
      });
    }

    res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

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

