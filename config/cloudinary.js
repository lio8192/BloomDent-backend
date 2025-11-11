const cloudinary = require('cloudinary').v2;

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 이미지 업로드 함수
const uploadImage = async (filePath, options = {}) => {
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

