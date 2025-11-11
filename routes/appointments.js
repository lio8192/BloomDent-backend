const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 예약 생성 (설문 포함)
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      user_id, // 로그인한 사용자 ID (optional)
      clinic_id,
      slot_id,
      patient_name,
      patient_phone,
      patient_email,
      patient_birth_date,
      symptoms,
      survey_answers // [{ question_id: 1, answer: 'yes' }, ...]
    } = req.body;

    // 필수 필드 검증
    if (!clinic_id || !slot_id || !patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        message: '필수 정보를 모두 입력해주세요. (치과, 시간, 이름, 전화번호)'
      });
    }

    await connection.beginTransaction();

    // 슬롯이 예약 가능한지 확인
    const [slots] = await connection.query(
      'SELECT * FROM appointment_slots WHERE id = ? AND clinic_id = ? AND is_available = TRUE',
      [slot_id, clinic_id]
    );

    if (slots.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: '해당 시간은 이미 예약되었거나 존재하지 않습니다.'
      });
    }

    // 예약 생성
    const [appointmentResult] = await connection.query(
      `INSERT INTO appointments 
       (user_id, clinic_id, slot_id, patient_name, patient_phone, patient_email, patient_birth_date, symptoms, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user_id || null, clinic_id, slot_id, patient_name, patient_phone, patient_email, patient_birth_date, symptoms]
    );

    const appointmentId = appointmentResult.insertId;

    // 설문 응답 저장
    if (survey_answers && Array.isArray(survey_answers) && survey_answers.length > 0) {
      const surveyValues = survey_answers.map(survey => [
        appointmentId,
        survey.question_id,
        survey.answer
      ]);

      await connection.query(
        'INSERT INTO appointment_surveys (appointment_id, question_id, answer) VALUES ?',
        [surveyValues]
      );
    }

    // 슬롯을 예약 불가능으로 변경
    await connection.query(
      'UPDATE appointment_slots SET is_available = FALSE WHERE id = ?',
      [slot_id]
    );

    await connection.commit();

    // 생성된 예약 정보 조회
    const [newAppointment] = await connection.query(
      `SELECT 
        a.*,
        dc.name as clinic_name,
        dc.address as clinic_address,
        dc.phone as clinic_phone,
        s.date as appointment_date,
        s.time_slot as appointment_time
       FROM appointments a
       JOIN dental_clinics dc ON a.clinic_id = dc.id
       JOIN appointment_slots s ON a.slot_id = s.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    res.status(201).json({
      success: true,
      message: '예약이 성공적으로 생성되었습니다.',
      data: newAppointment[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('예약 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 예약 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.query(
      `SELECT 
        a.*,
        dc.name as clinic_name,
        dc.address as clinic_address,
        dc.phone as clinic_phone,
        dc.latitude,
        dc.longitude,
        s.date as appointment_date,
        s.time_slot as appointment_time
       FROM appointments a
       JOIN dental_clinics dc ON a.clinic_id = dc.id
       JOIN appointment_slots s ON a.slot_id = s.id
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 예약을 찾을 수 없습니다.'
      });
    }

    // 설문 응답 조회
    const [surveyAnswers] = await pool.query(
      `SELECT 
        aps.id,
        aps.question_id,
        sq.question,
        sq.question_type,
        aps.answer
       FROM appointment_surveys aps
       JOIN survey_questions sq ON aps.question_id = sq.id
       WHERE aps.appointment_id = ?
       ORDER BY sq.order_num`,
      [id]
    );

    const result = {
      ...appointments[0],
      survey_answers: surveyAnswers
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('예약 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전화번호로 예약 목록 조회
router.get('/patient/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
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
      WHERE a.patient_phone = ?
    `;

    const params = [phone];

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

// 예약 취소
router.put('/:id/cancel', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // 예약 정보 조회
    const [appointments] = await connection.query(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '해당 예약을 찾을 수 없습니다.'
      });
    }

    const appointment = appointments[0];

    if (appointment.status === 'cancelled') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 취소된 예약입니다.'
      });
    }

    // 예약 상태를 취소로 변경
    await connection.query(
      'UPDATE appointments SET status = "cancelled", updated_at = NOW() WHERE id = ?',
      [id]
    );

    // 슬롯을 다시 예약 가능으로 변경
    await connection.query(
      'UPDATE appointment_slots SET is_available = TRUE WHERE id = ?',
      [appointment.slot_id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: '예약이 취소되었습니다.',
      data: { id: parseInt(id), status: 'cancelled' }
    });

  } catch (error) {
    await connection.rollback();
    console.error('예약 취소 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 취소 중 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// 사전 자가진단 설문 질문 목록 조회
router.get('/surveys/questions', async (req, res) => {
  try {
    const [questions] = await pool.query(
      'SELECT * FROM survey_questions WHERE is_active = TRUE ORDER BY order_num'
    );

    res.json({
      success: true,
      count: questions.length,
      data: questions
    });

  } catch (error) {
    console.error('설문 질문 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '설문 질문 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

