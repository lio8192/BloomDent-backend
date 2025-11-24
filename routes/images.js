const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const upload = require('../config/multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// 사진 업로드 및 분석 요청
router.post('/upload', upload.single('image'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { user_id, image_type } = req.body;

    // 파일 확인
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 필요합니다.'
      });
    }

    // user_id 필수 확인
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '사용자 ID(user_id)가 필요합니다.'
      });
    }

    console.log('📤 이미지 업로드 시작:', req.file.originalname);

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

    // 3. DB에 이미지 정보 저장 (user_id와 cloudinary_url 저장)
    const [imageResult] = await pool.query(
      `INSERT INTO dental_images 
       (user_id, cloudinary_id, cloudinary_url, original_filename, image_type, analysis_status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        user_id,
        cloudinaryResult.cloudinary_id,
        cloudinaryResult.cloudinary_url,
        req.file.originalname,
        image_type || 'other'
      ]
    );

    const imageId = imageResult.insertId;
    console.log('💾 DB 저장 완료, Image ID:', imageId);

    // 4. Flask AI 서버로 비동기 분석 요청
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

    // 5. 즉시 응답 반환 (분석은 백그라운드에서 진행)
    res.status(201).json({
      success: true,
      message: '이미지 업로드 완료. 분석이 진행 중입니다.',
      data: {
        image_id: imageId,
        cloudinary_url: cloudinaryResult.cloudinary_url,
        analysis_status: 'processing'
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

// 이미지 분석 상태 조회
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const [images] = await pool.query(
      `SELECT 
        id, cloudinary_url, image_type, analysis_status, uploaded_at
       FROM dental_images 
       WHERE id = ?`,
      [id]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: images[0]
    });

  } catch (error) {
    console.error('상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상태 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 이미지 분석 결과 조회
router.get('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;

    // 이미지 정보와 분석 결과 조회
    const [results] = await pool.query(
      `SELECT 
        di.id,
        di.cloudinary_url,
        di.image_type,
        di.analysis_status,
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
       WHERE di.id = ?`,
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: '이미지를 찾을 수 없습니다.'
      });
    }

    const result = results[0];

    // 분석이 완료되지 않은 경우
    if (result.analysis_status !== 'completed') {
      return res.json({
        success: true,
        data: {
          image_id: result.id,
          cloudinary_url: result.cloudinary_url,
          analysis_status: result.analysis_status,
          message: result.analysis_status === 'processing' 
            ? '분석이 진행 중입니다.' 
            : result.analysis_status === 'failed'
            ? '분석에 실패했습니다.'
            : '분석 대기 중입니다.'
        }
      });
    }

    // 분석 완료된 경우 전체 데이터 반환
    res.json({
      success: true,
      data: {
        image_id: result.id,
        cloudinary_url: result.cloudinary_url,
        image_type: result.image_type,
        uploaded_at: result.uploaded_at,
        analysis: {
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
        }
      }
    });

  } catch (error) {
    console.error('분석 결과 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '분석 결과 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

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
        di.analysis_status,
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

