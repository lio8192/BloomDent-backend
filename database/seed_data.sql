-- 샘플 데이터 삽입

-- 1. 사용자 계정 샘플 데이터
-- 비밀번호: password123 (bcrypt 해시)
INSERT INTO users (username, password, name, phone, email) VALUES
('user1', '$2b$10$y/u/GzhdCy7t4/LpVvFQoud9HGEX2g28U0pkpf2vSCz1JqgdKFp8i', '김철수', '010-1111-2222', 'kim@example.com'),
('user2', '$2b$10$y/u/GzhdCy7t4/LpVvFQoud9HGEX2g28U0pkpf2vSCz1JqgdKFp8i', '이영희', '010-3333-4444', 'lee@example.com'),
('test', '$2b$10$y/u/GzhdCy7t4/LpVvFQoud9HGEX2g28U0pkpf2vSCz1JqgdKFp8i', '테스트', '010-5555-6666', 'test@example.com');

-- 2. 치과 병원 샘플 데이터 (서울 강남 지역 기준)
INSERT INTO dental_clinics (name, latitude, longitude, address, phone, description) VALUES
('서울밝은치과', 37.5012767, 127.0396597, '서울특별시 강남구 테헤란로 123', '02-1234-5678', '첨단 장비를 갖춘 종합 치과입니다.'),
('강남스마일치과', 37.4979462, 127.0276368, '서울특별시 강남구 강남대로 456', '02-2345-6789', '심미치과 전문 병원입니다.'),
('역삼연세치과', 37.5008672, 127.0368682, '서울특별시 강남구 역삼로 789', '02-3456-7890', '임플란트 전문 치과입니다.'),
('선릉행복치과', 37.5046242, 127.0493939, '서울특별시 강남구 선릉로 321', '02-4567-8901', '가족 주치의 치과를 지향합니다.'),
('삼성화이트치과', 37.5090745, 127.0633986, '서울특별시 강남구 삼성로 654', '02-5678-9012', '소아치과 진료 가능합니다.');

-- 3. 예약 가능 시간 슬롯 생성 (다음 2주간)
-- 치과 1번: 평일 09:00-18:00 (점심시간 12:00-13:00 제외)
INSERT INTO appointment_slots (clinic_id, date, time_slot, is_available) VALUES
-- 2025-11-11 (화요일)
(1, '2025-11-11', '09:00:00', TRUE),
(1, '2025-11-11', '10:00:00', TRUE),
(1, '2025-11-11', '11:00:00', TRUE),
(1, '2025-11-11', '13:00:00', TRUE),
(1, '2025-11-11', '14:00:00', TRUE),
(1, '2025-11-11', '15:00:00', TRUE),
(1, '2025-11-11', '16:00:00', TRUE),
(1, '2025-11-11', '17:00:00', TRUE),
-- 2025-11-12 (수요일)
(1, '2025-11-12', '09:00:00', TRUE),
(1, '2025-11-12', '10:00:00', TRUE),
(1, '2025-11-12', '11:00:00', TRUE),
(1, '2025-11-12', '13:00:00', TRUE),
(1, '2025-11-12', '14:00:00', TRUE),
(1, '2025-11-12', '15:00:00', TRUE),
(1, '2025-11-12', '16:00:00', TRUE),
(1, '2025-11-12', '17:00:00', TRUE);

-- 치과 2번: 예약 시간
INSERT INTO appointment_slots (clinic_id, date, time_slot, is_available) VALUES
(2, '2025-11-11', '09:30:00', TRUE),
(2, '2025-11-11', '10:30:00', TRUE),
(2, '2025-11-11', '11:30:00', TRUE),
(2, '2025-11-11', '14:00:00', TRUE),
(2, '2025-11-11', '15:00:00', TRUE),
(2, '2025-11-11', '16:00:00', TRUE),
(2, '2025-11-12', '09:30:00', TRUE),
(2, '2025-11-12', '10:30:00', TRUE),
(2, '2025-11-12', '11:30:00', TRUE),
(2, '2025-11-12', '14:00:00', TRUE),
(2, '2025-11-12', '15:00:00', TRUE),
(2, '2025-11-12', '16:00:00', TRUE);

-- 4. 사전 자가진단 설문 질문
INSERT INTO survey_questions (question, question_type, options, order_num, is_active) VALUES
('현재 치아에 통증이 있으신가요?', 'yes_no', NULL, 1, TRUE),
('잇몸에서 피가 나거나 붓기가 있나요?', 'yes_no', NULL, 2, TRUE),
('최근 6개월 이내에 치과 진료를 받으신 적이 있나요?', 'yes_no', NULL, 3, TRUE),
('치아 교정 또는 임플란트 시술 경험이 있으신가요?', 'yes_no', NULL, 4, TRUE),
('현재 복용 중인 약이 있으신가요?', 'yes_no', NULL, 5, TRUE),
('알레르기가 있으신가요?', 'yes_no', NULL, 6, TRUE),
('방문 목적을 선택해주세요.', 'multiple_choice', JSON_ARRAY('정기 검진', '충치 치료', '잇몸 치료', '임플란트', '교정', '기타'), 7, TRUE),
('추가로 전달하실 내용이 있으신가요?', 'text', NULL, 8, TRUE);

-- 5. 샘플 예약 데이터
INSERT INTO appointments (user_id, clinic_id, slot_id, patient_name, patient_phone, patient_email, patient_birth_date, symptoms, status) VALUES
(1, 1, 1, '김철수', '010-1111-2222', 'kim@example.com', '1990-05-15', '치아 통증이 있습니다.', 'confirmed'),
(2, 1, 2, '이영희', '010-3333-4444', 'lee@example.com', '1985-08-20', '정기 검진 받고 싶습니다.', 'pending');

-- 6. 샘플 설문 응답
INSERT INTO appointment_surveys (appointment_id, question_id, answer) VALUES
(1, 1, 'yes'),
(1, 2, 'no'),
(1, 3, 'yes'),
(1, 4, 'no'),
(1, 5, 'no'),
(1, 6, 'no'),
(1, 7, '충치 치료'),
(1, 8, '오른쪽 어금니가 아픕니다.');

-- 예약 1번에 해당하는 슬롯을 예약 불가능으로 변경
UPDATE appointment_slots SET is_available = FALSE WHERE id = 1;

