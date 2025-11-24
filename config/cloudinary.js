const cloudinary = require('cloudinary').v2;

// Cloudinary 환경 변수 확인
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// 환경 변수 검증
if (!cloudName || !apiKey || !apiSecret) {
  console.warn('⚠️  Cloudinary 환경 변수가 설정되지 않았습니다.');
  console.warn('   다음 환경 변수를 .env 파일에 추가해주세요:');
  console.warn('   - CLOUDINARY_CLOUD_NAME');
  console.warn('   - CLOUDINARY_API_KEY');
  console.warn('   - CLOUDINARY_API_SECRET');
  console.warn('   이미지 업로드 기능이 작동하지 않을 수 있습니다.\n');
} else {
  console.log('✅ Cloudinary 설정 완료');
}

// Cloudinary 설정
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

// 이미지 업로드 함수
const uploadImage = async (filePath, options = {}) => {
  // 환경 변수 확인
  if (!cloudName || !apiKey || !apiSecret) {
    return {
      success: false,
      error: 'Cloudinary API 키가 설정되지 않았습니다. .env 파일에 CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET을 추가해주세요.'
    };
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: options.folder || 'dental-images',
      resource_type: 'image',
      quality: 'auto',
      fetch_format: 'auto',
      ...options
    });
    
    return {
      success: true,
      cloudinary_id: result.public_id,
      cloudinary_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format
    };
  } catch (error) {
    console.error('Cloudinary 업로드 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 이미지 삭제 함수
const deleteImage = async (cloudinaryId) => {
  try {
    const result = await cloudinary.uploader.destroy(cloudinaryId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('Cloudinary 삭제 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage
};

