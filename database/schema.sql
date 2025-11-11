-- BloomDent 데이터베이스 스키마

-- 1. 사용자 계정 테이블
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '아이디',
  password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
  name VARCHAR(100) NOT NULL COMMENT '이름',
  phone VARCHAR(20) COMMENT '전화번호',
  email VARCHAR(100) COMMENT '이메일',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 계정';

-- 2. 치과 병원 정보 테이블
CREATE TABLE IF NOT EXISTS dental_clinics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL COMMENT '치과 이름',
  latitude DECIMAL(10, 8) NOT NULL COMMENT '위도',
  longitude DECIMAL(11, 8) NOT NULL COMMENT '경도',
  address VARCHAR(500) NOT NULL COMMENT '주소',
  phone VARCHAR(20) NOT NULL COMMENT '전화번호',
  description TEXT COMMENT '병원 소개',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='치과 병원 정보';

-- 3. 예약 가능 시간 슬롯 테이블
CREATE TABLE IF NOT EXISTS appointment_slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clinic_id INT NOT NULL,
  date DATE NOT NULL COMMENT '예약 날짜',
  time_slot TIME NOT NULL COMMENT '예약 시간',
  is_available BOOLEAN DEFAULT TRUE COMMENT '예약 가능 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clinic_id) REFERENCES dental_clinics(id) ON DELETE CASCADE,
  UNIQUE KEY unique_slot (clinic_id, date, time_slot),
  INDEX idx_clinic_date (clinic_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='예약 가능 시간';

-- 4. 사전 자가진단 설문 질문 테이블
CREATE TABLE IF NOT EXISTS survey_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question TEXT NOT NULL COMMENT '질문 내용',
  question_type ENUM('yes_no', 'text', 'multiple_choice') DEFAULT 'yes_no' COMMENT '질문 유형',
  options JSON COMMENT '선택지 (객관식인 경우)',
  order_num INT DEFAULT 0 COMMENT '질문 순서',
  is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사전 자가진단 설문';

-- 5. 예약 정보 테이블
CREATE TABLE IF NOT EXISTS appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT COMMENT '사용자 ID (로그인한 경우)',
  clinic_id INT NOT NULL,
  slot_id INT NOT NULL,
  patient_name VARCHAR(100) NOT NULL COMMENT '예약자 이름',
  patient_phone VARCHAR(20) NOT NULL COMMENT '예약자 전화번호',
  patient_email VARCHAR(100) COMMENT '예약자 이메일',
  patient_birth_date DATE COMMENT '생년월일',
  symptoms TEXT COMMENT '증상 설명',
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '예약 상태',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (clinic_id) REFERENCES dental_clinics(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES appointment_slots(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_patient_phone (patient_phone),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='예약 정보';

-- 6. 예약별 설문 응답 테이블
CREATE TABLE IF NOT EXISTS appointment_surveys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  appointment_id INT NOT NULL,
  question_id INT NOT NULL,
  answer TEXT NOT NULL COMMENT '답변 내용',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
  INDEX idx_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='예약별 설문 응답';

-- 7. 치아 사진 테이블
CREATE TABLE IF NOT EXISTS dental_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT COMMENT '사용자 ID',
  cloudinary_id VARCHAR(255) NOT NULL COMMENT 'Cloudinary 고유 ID',
  cloudinary_url TEXT NOT NULL COMMENT 'Cloudinary 이미지 URL',
  original_filename VARCHAR(255) COMMENT '원본 파일명',
  image_type ENUM('front', 'side', 'upper', 'lower', 'other') DEFAULT 'other' COMMENT '사진 유형',
  analysis_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '분석 상태',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (analysis_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='치아 사진';

-- 8. 사진 분석 결과 테이블
CREATE TABLE IF NOT EXISTS image_analysis (
  id INT PRIMARY KEY AUTO_INCREMENT,
  image_id INT NOT NULL,
  occlusion_status VARCHAR(100) COMMENT '교합 상태',
  occlusion_comment TEXT COMMENT '교합 코멘트',
  cavity_detected BOOLEAN DEFAULT FALSE COMMENT '충치 발견 여부',
  cavity_locations JSON COMMENT '충치 위치 정보',
  cavity_comment TEXT COMMENT '충치 코멘트',
  gum_status VARCHAR(100) COMMENT '잇몸 상태',
  gum_comment TEXT COMMENT '잇몸 코멘트',
  overall_score DECIMAL(3, 1) COMMENT '종합 점수 (0-10)',
  recommendations TEXT COMMENT '추천 사항',
  ai_confidence DECIMAL(5, 2) COMMENT 'AI 신뢰도 (%)',
  raw_response JSON COMMENT 'AI 원본 응답',
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES dental_images(id) ON DELETE CASCADE,
  INDEX idx_image_id (image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사진 분석 결과';

