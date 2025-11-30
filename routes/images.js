const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const upload = require('../config/multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// AI 서버 URL (환경 변수에서 가져오기)
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:5000';

// 임시 파일 저장 함수
const saveTempFile = (buffer, originalname) => {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFilePath = path.join(tempDir, `${Date.now()}-${originalname}`);
  fs.writeFileSync(tempFilePath, buffer);
  return tempFilePath;
};

// 임시 파일 삭제 함수
const deleteTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('임시 파일 삭제 오류:', error);
  }
};

// history_id 할당 함수 (UUID v4 사용)
async function getOrCreateHistoryId(userId) {
  if (!userId) {
    return null;
  }

  try {
    // 사용자의 최근 이미지들 조회 (history_id가 있는 것만)
    const [recentImages] = await pool.query(
      `SELECT history_id, position 
       FROM dental_images 
       WHERE user_id = ? AND history_id IS NOT NULL 
       ORDER BY uploaded_at DESC 
       LIMIT 10`,
      [userId]
    );

    if (recentImages.length === 0) {
      // 첫 번째 세트 - 새 UUID 생성
      return crypto.randomUUID();
    }

    // 최근 history_id별로 그룹화
    const historyGroups = {};
    for (const img of recentImages) {
      if (!historyGroups[img.history_id]) {
        historyGroups[img.history_id] = new Set();
      }
      historyGroups[img.history_id].add(img.position);
    }

    // 가장 최근 history_id 확인
    const latestHistoryId = recentImages[0].history_id;
    const positions = historyGroups[latestHistoryId];

    // upper, lower, front가 모두 있는지 확인
    if (positions && positions.has('upper') && positions.has('lower') && positions.has('front')) {
      // 모두 있으면 새로운 UUID 생성
      return crypto.randomUUID();
    } else {
      // 아직 완성되지 않았으면 기존 history_id 사용
      return latestHistoryId;
    }
  } catch (error) {
    console.error('history_id 할당 오류:', error);
    // 오류 발생 시 새 UUID 생성
    return crypto.randomUUID();
  }
}

// 사진 업로드 및 분석 요청
router.post('/upload', upload.single('image'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { user_id, image_type, position } = req.body;

    // 파일 확인
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다.'
      });
    }

    // position 값 검증
    const validPositions = ['upper', 'lower', 'front'];
    const validatedPosition = position && validPositions.includes(position) ? position : null;
    
    console.log('📤 이미지 업로드 시작:', req.file.originalname);
    console.log('📋 업로드 파라미터:', { user_id, image_type, position, validatedPosition });

    // 1. 임시 파일 저장
    tempFilePath = saveTempFile(req.file.buffer, req.file.originalname);

    // 2. Cloudinary에 업로드
    console.log('☁️  Cloudinary 업로드 중...');
    const cloudinaryResult = await uploadImage(tempFilePath, {
      folder: 'dental-images',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    if (!cloudinaryResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary 업로드 실패',
        error: cloudinaryResult.error
      });
    }

    console.log('✅ Cloudinary 업로드 완료:', cloudinaryResult.cloudinary_id);

    // 3. history_id 할당
    const historyId = await getOrCreateHistoryId(user_id);
    console.log('📝 할당된 history_id:', historyId);

    // 4. DB에 이미지 정보 저장
    const [imageResult] = await pool.query(
      `INSERT INTO dental_images 
       (user_id, cloudinary_id, cloudinary_url, original_filename, position, image_type, analysis_status, history_id) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        user_id || null,
        cloudinaryResult.cloudinary_id,
        cloudinaryResult.cloudinary_url,
        req.file.originalname,
        validatedPosition,
        image_type || 'other',
        historyId
      ]
    );

    const imageId = imageResult.insertId;
    console.log('💾 DB 저장 완료, Image ID:', imageId);

    // 5. Flask AI 서버로 비동기 분석 요청
    console.log('🤖 AI 분석 요청 전송 중...');
    
    // 분석 상태를 processing으로 변경
    await pool.query(
      'UPDATE dental_images SET analysis_status = "processing" WHERE id = ?',
      [imageId]
    );

    // 비동기로 AI 분석 처리 (응답을 기다리지 않음)
    processAIAnalysis(imageId, cloudinaryResult.cloudinary_url, tempFilePath).catch(err => {
      console.error('AI 분석 백그라운드 처리 오류:', err);
    });

    // 6. 즉시 응답 반환 (분석은 백그라운드에서 진행)
    res.status(201).json({
      success: true,
      message: '이미지 업로드 완료. 분석이 진행 중입니다.',
      data: {
        image_id: imageId,
        cloudinary_url: cloudinaryResult.cloudinary_url,
        analysis_status: 'processing',
        history_id: historyId
      }
    });

  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    
    // 임시 파일 삭제
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// AI 분석 백그라운드 처리 함수
async function processAIAnalysis(imageId, imageUrl, tempFilePath) {
  try {
    console.log(`🔄 [Image ${imageId}] AI 분석 시작...`);

    // Flask AI 서버로 요청
    const aiResponse = await axios.post(
      `${AI_SERVER_URL}/api/analyze`,
      {
        image_url: imageUrl,
        image_id: imageId
      },
      {
        timeout: 60000 // 60초 타임아웃
      }
    );

    console.log(`✅ [Image ${imageId}] AI 분석 완료`);

    const analysisData = aiResponse.data;

    // DB에 분석 결과 저장
    await pool.query(
      `INSERT INTO image_analysis 
       (image_id, occlusion_status, occlusion_comment, cavity_detected, 
        cavity_locations, cavity_comment, overall_score, recommendations, 
        ai_confidence, raw_response) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        imageId,
        analysisData.occlusion_status || null,
        analysisData.occlusion_comment || null,
        analysisData.cavity_detected || false,
        JSON.stringify(analysisData.cavity_locations || []),
        analysisData.cavity_comment || null,
        analysisData.overall_score || null,
        analysisData.recommendations || null,
        analysisData.ai_confidence || null,
        JSON.stringify(analysisData)
      ]
    );

    // 이미지 상태를 completed로 변경
    await pool.query(
      'UPDATE dental_images SET analysis_status = "completed" WHERE id = ?',
      [imageId]
    );

    console.log(`💾 [Image ${imageId}] 분석 결과 저장 완료`);

  } catch (error) {
    console.error(`❌ [Image ${imageId}] AI 분석 실패:`, error.message);

    // 이미지 상태를 failed로 변경
    await pool.query(
      'UPDATE dental_images SET analysis_status = "failed" WHERE id = ?',
      [imageId]
    );
  } finally {
    // 임시 파일 삭제
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }
  }
}

// 사용자의 이미지 목록 조회
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // 상태 필터 (optional)

    let query = `
      SELECT 
        di.id,
        di.cloudinary_url,
        di.image_type,
        di.position,
        di.analysis_status,
        di.history_id,
        di.uploaded_at,
        ia.overall_score,
        ia.analyzed_at
      FROM dental_images di
      LEFT JOIN image_analysis ia ON di.id = ia.image_id
      WHERE di.user_id = ?
    `;

    const params = [userId];

    if (status) {
      query += ' AND di.analysis_status = ?';
      params.push(status);
    }

    query += ' ORDER BY di.uploaded_at DESC';

    const [images] = await pool.query(query, params);

    res.json({
      success: true,
      count: images.length,
      data: images
    });

  } catch (error) {
    console.error('이미지 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// history_id별 분석 결과 조회 (3개 사진 세트)
router.get('/history/:historyId/analysis', async (req, res) => {
  try {
    const { historyId } = req.params;

    // 해당 history_id의 모든 이미지와 분석 결과 조회
    const [results] = await pool.query(
      `SELECT 
        di.id,
        di.cloudinary_url,
        di.image_type,
        di.position,
        di.analysis_status,
        di.history_id,
        di.uploaded_at,
        ia.occlusion_status,
        ia.occlusion_comment,
        ia.cavity_detected,
        ia.cavity_locations,
        ia.cavity_comment,
        ia.overall_score,
        ia.recommendations,
        ia.ai_confidence,
        ia.analyzed_at
       FROM dental_images di
       LEFT JOIN image_analysis ia ON di.id = ia.image_id
       WHERE di.history_id = ?
       ORDER BY 
         CASE di.position
           WHEN 'upper' THEN 1
           WHEN 'lower' THEN 2
           WHEN 'front' THEN 3
           ELSE 4
         END`,
      [historyId]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 history_id의 이미지를 찾을 수 없습니다.'
      });
    }

    // position별로 그룹화
    const imagesByPosition = {
      upper: null,
      lower: null,
      front: null
    };

    for (const result of results) {
      if (result.position && imagesByPosition.hasOwnProperty(result.position)) {
        imagesByPosition[result.position] = {
          image_id: result.id,
          cloudinary_url: result.cloudinary_url,
          image_type: result.image_type,
          position: result.position,
          analysis_status: result.analysis_status,
          uploaded_at: result.uploaded_at,
          analysis: result.analysis_status === 'completed' ? {
            occlusion: {
              status: result.occlusion_status,
              comment: result.occlusion_comment
            },
            cavity: {
              detected: result.cavity_detected,
              locations: result.cavity_locations,
              comment: result.cavity_comment
            },
            overall_score: result.overall_score,
            recommendations: result.recommendations,
            ai_confidence: result.ai_confidence,
            analyzed_at: result.analyzed_at
          } : null
        };
      }
    }

    res.json({
      success: true,
      data: {
        history_id: historyId,
        images: imagesByPosition,
        uploaded_at: results[0].uploaded_at
      }
    });

  } catch (error) {
    console.error('history별 분석 결과 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '분석 결과 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자의 history_id 목록 조회
router.get('/user/:userId/histories', async (req, res) => {
  try {
    const { userId } = req.params;

    const [histories] = await pool.query(
      `SELECT DISTINCT 
        history_id,
        MIN(uploaded_at) as first_uploaded_at,
        MAX(uploaded_at) as last_uploaded_at,
        COUNT(*) as image_count,
        SUM(CASE WHEN analysis_status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM dental_images 
       WHERE user_id = ? AND history_id IS NOT NULL
       GROUP BY history_id
       ORDER BY history_id DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: histories.length,
      data: histories
    });

  } catch (error) {
    console.error('history 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'history 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 이미지 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 이미지 정보 조회
    const [images] = await pool.query(
      'SELECT cloudinary_id FROM dental_images WHERE id = ?',
      [id]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    // Cloudinary에서 삭제
    const cloudinaryResult = await deleteImage(images[0].cloudinary_id);
    
    if (!cloudinaryResult.success) {
      console.warn('Cloudinary 삭제 실패:', cloudinaryResult.error);
    }

    // DB에서 삭제 (CASCADE로 분석 결과도 함께 삭제됨)
    await pool.query('DELETE FROM dental_images WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '이미지가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

