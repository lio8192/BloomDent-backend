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
  overall_score DECIMAL(3, 1) COMMENT '종합 점수 (0-10)',
  recommendations TEXT COMMENT '추천 사항',
  ai_confidence DECIMAL(5, 2) COMMENT 'AI 신뢰도 (%)',
  raw_response JSON COMMENT 'AI 원본 응답',
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES dental_images(id) ON DELETE CASCADE,
  INDEX idx_image_id (image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사진 분석 결과';

-- 9. 설문 문항 테이블
CREATE TABLE IF NOT EXISTS survey_questions_master (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_number INT NOT NULL UNIQUE COMMENT '문항번호',
  question_text TEXT NOT NULL COMMENT '문항내용',
  max_score DECIMAL(5, 2) NOT NULL COMMENT '문항당배점',
  is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_question_number (question_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='설문 문항';

-- 10. 설문 응답 옵션 테이블
CREATE TABLE IF NOT EXISTS survey_question_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_number INT NOT NULL COMMENT '문항번호',
  option_number INT NOT NULL COMMENT '응답번호',
  option_text VARCHAR(255) NOT NULL COMMENT '응답내용',
  next_question_number INT COMMENT '다음문항 (NULL이면 설문 종료)',
  score DECIMAL(5, 2) NOT NULL COMMENT '배점',
  category ENUM('구강관리/양치습관', '구치/구강건조', '흡연/음주', '우식성 식품 섭취', '지각과민/불소', '구강악습관') NOT NULL COMMENT '카테고리',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_number) REFERENCES survey_questions_master(question_number) ON DELETE CASCADE,
  UNIQUE KEY unique_option (question_number, option_number),
  INDEX idx_question_number (question_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='설문 응답 옵션';

-- 11. 사용자 설문 응답 테이블
CREATE TABLE IF NOT EXISTS user_survey_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '사용자 ID',
  survey_session_id VARCHAR(50) NOT NULL COMMENT '설문 세션 ID',
  question_number INT NOT NULL COMMENT '문항번호',
  option_number INT NOT NULL COMMENT '응답번호',
  score DECIMAL(5, 2) NOT NULL COMMENT '획득 점수',
  category VARCHAR(50) NOT NULL COMMENT '카테고리',
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_number) REFERENCES survey_questions_master(question_number) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_session (survey_session_id),
  INDEX idx_answered_at (answered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 설문 응답';

-- 12. 사용자 카테고리별 건강 점수 테이블
CREATE TABLE IF NOT EXISTS user_health_scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total_score DECIMAL(5, 2) DEFAULT 0 COMMENT '총점 (0-100)',
  oral_care_score DECIMAL(5, 2) DEFAULT 0 COMMENT '구강관리/양치습관 점수',
  cavity_dryness_score DECIMAL(5, 2) DEFAULT 0 COMMENT '구치/구강건조 점수',
  smoking_drinking_score DECIMAL(5, 2) DEFAULT 0 COMMENT '흡연/음주 점수',
  cariogenic_food_score DECIMAL(5, 2) DEFAULT 0 COMMENT '우식성 식품 섭취 점수',
  sensitivity_fluoride_score DECIMAL(5, 2) DEFAULT 0 COMMENT '지각과민/불소 점수',
  oral_habits_score DECIMAL(5, 2) DEFAULT 0 COMMENT '구강악습관 점수',
  last_survey_session_id VARCHAR(50) COMMENT '마지막 설문 세션 ID',
  last_survey_date TIMESTAMP COMMENT '마지막 설문 날짜',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_total_score (total_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 카테고리별 건강 점수';

-- 13. 점수 이력 테이블
CREATE TABLE IF NOT EXISTS score_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  total_score DECIMAL(5, 2) NOT NULL COMMENT '총점',
  oral_care_score DECIMAL(5, 2) COMMENT '구강관리/양치습관',
  cavity_dryness_score DECIMAL(5, 2) COMMENT '구치/구강건조',
  smoking_drinking_score DECIMAL(5, 2) COMMENT '흡연/음주',
  cariogenic_food_score DECIMAL(5, 2) COMMENT '우식성 식품 섭취',
  sensitivity_fluoride_score DECIMAL(5, 2) COMMENT '지각과민/불소',
  oral_habits_score DECIMAL(5, 2) COMMENT '구강악습관',
  score_type ENUM('survey', 'manual', 'initial') DEFAULT 'survey' COMMENT '점수 유형',
  survey_session_id VARCHAR(50) COMMENT '설문 세션 ID',
  calculation_details JSON COMMENT '계산 상세 정보',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='점수 이력';

