const multer = require('multer');
const path = require('path');

// 메모리 스토리지 사용 (Cloudinary로 직접 업로드)
const storage = multer.memoryStorage();

// 파일 필터 (이미지만 허용)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (jpeg, jpg, png, gif, webp)'));
  }
};

// Multer 설정
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 제한
  },
  fileFilter: fileFilter
});

module.exports = upload;

