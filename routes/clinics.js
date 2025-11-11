const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Haversine 공식을 사용하여 두 지점 간의 거리 계산 (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// 주변 치과 검색 (위치 기반)
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    // 필수 파라미터 검증
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: '위도(latitude)와 경도(longitude)는 필수입니다.'
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    // 모든 치과 정보 조회
    const [clinics] = await pool.query(
      'SELECT * FROM dental_clinics ORDER BY created_at DESC'
    );

    // 거리 계산 및 필터링
    const nearbyClinic = clinics
      .map(clinic => ({
        ...clinic,
        distance: calculateDistance(lat, lon, parseFloat(clinic.latitude), parseFloat(clinic.longitude))
      }))
      .filter(clinic => clinic.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      count: nearbyClinic.length,
      searchLocation: {
        latitude: lat,
        longitude: lon,
        radius: searchRadius
      },
      data: nearbyClinic
    });

  } catch (error) {
    console.error('주변 치과 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '주변 치과 검색 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 치과 이름으로 검색
router.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '검색어(keyword)는 필수입니다.'
      });
    }

    const [clinics] = await pool.query(
      'SELECT * FROM dental_clinics WHERE name LIKE ? OR address LIKE ? ORDER BY name',
      [`%${keyword}%`, `%${keyword}%`]
    );

    res.json({
      success: true,
      count: clinics.length,
      keyword: keyword,
      data: clinics
    });

  } catch (error) {
    console.error('치과 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '치과 검색 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 치과 상세 정보 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [clinics] = await pool.query(
      'SELECT * FROM dental_clinics WHERE id = ?',
      [id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 치과를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: clinics[0]
    });

  } catch (error) {
    console.error('치과 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '치과 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 치과의 예약 가능한 날짜 조회
router.get('/:id/available-dates', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // 기본값: 오늘부터 30일간
    const fromDate = from_date || new Date().toISOString().split('T')[0];
    const toDate = to_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dates] = await pool.query(
      `SELECT DISTINCT date 
       FROM appointment_slots 
       WHERE clinic_id = ? 
         AND date BETWEEN ? AND ? 
         AND is_available = TRUE
       ORDER BY date`,
      [id, fromDate, toDate]
    );

    res.json({
      success: true,
      clinic_id: parseInt(id),
      count: dates.length,
      data: dates.map(d => d.date)
    });

  } catch (error) {
    console.error('예약 가능 날짜 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 가능 날짜 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 치과의 특정 날짜 예약 가능한 시간 조회
router.get('/:id/available-slots', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '날짜(date)는 필수입니다. (형식: YYYY-MM-DD)'
      });
    }

    const [slots] = await pool.query(
      `SELECT id, time_slot, is_available 
       FROM appointment_slots 
       WHERE clinic_id = ? AND date = ? AND is_available = TRUE
       ORDER BY time_slot`,
      [id, date]
    );

    res.json({
      success: true,
      clinic_id: parseInt(id),
      date: date,
      count: slots.length,
      data: slots
    });

  } catch (error) {
    console.error('예약 가능 시간 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '예약 가능 시간 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 모든 치과 목록 조회
router.get('/', async (req, res) => {
  try {
    const [clinics] = await pool.query(
      'SELECT * FROM dental_clinics ORDER BY name'
    );

    res.json({
      success: true,
      count: clinics.length,
      data: clinics
    });

  } catch (error) {
    console.error('치과 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '치과 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

