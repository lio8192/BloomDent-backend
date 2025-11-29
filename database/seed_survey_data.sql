-- 설문 문항 샘플 데이터

-- 설문 문항 삽입
-- INSERT INTO survey_questions (question_number, question_text, max_score) VALUES
-- (1, '양치질만으로는 구강관리가 부족하다는 것을 알고 계십니까?', 3.75),
-- (2, '본인에게 알맞은 구강관리용품이 무엇인지 알고 계십니까?', 3.75),
-- (3, '구강관리용품을 주기적으로 사용하십니까?', 3.75),
-- (4, '하루에 몇 번 양치질을 하십니까?', 5.00),
-- (5, '흡연을 하십니까?', 10.00),
-- (6, '음주를 얼마나 자주 하십니까?', 8.00);

-- -- 설문 응답 옵션 삽입 (문항 1)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (1, 1, '매우 그렇다', 2, 5, '구강관리/양치습관'),
-- (1, 2, '그렇다', 2, 4, '구강관리/양치습관'),
-- (1, 3, '보통이다', 2, 3, '구강관리/양치습관'),
-- (1, 4, '아니다', 2, 2, '구강관리/양치습관'),
-- (1, 5, '전혀 아니다', 2, 1, '구강관리/양치습관');

-- -- 설문 응답 옵션 삽입 (문항 2)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (2, 1, '매우 잘 알고 있다', 3, 5, '구강관리/양치습관'),
-- (2, 2, '어느 정도 알고 있다', 3, 4, '구강관리/양치습관'),
-- (2, 3, '보통이다', 3, 3, '구강관리/양치습관'),
-- (2, 4, '잘 모른다', 3, 2, '구강관리/양치습관'),
-- (2, 5, '전혀 모른다', 3, 1, '구강관리/양치습관');

-- -- 설문 응답 옵션 삽입 (문항 3)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (3, 1, '매우 규칙적이다', 4, 5, '구강관리/양치습관'),
-- (3, 2, '대체로 규칙적이다', 4, 4, '구강관리/양치습관'),
-- (3, 3, '보통이다', 4, 3, '구강관리/양치습관'),
-- (3, 4, '가끔 사용한다', 4, 2, '구강관리/양치습관'),
-- (3, 5, '거의 사용하지 않는다', 4, 1, '구강관리/양치습관');

-- -- 설문 응답 옵션 삽입 (문항 4)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (4, 1, '3번 이상', 5, 10, '구강관리/양치습관'),
-- (4, 2, '2번', 5, 7, '구강관리/양치습관'),
-- (4, 3, '1번', 5, 4, '구강관리/양치습관'),
-- (4, 4, '거의 안함', 5, 1, '구강관리/양치습관');

-- -- 설문 응답 옵션 삽입 (문항 5)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (5, 1, '예 (하루 1갑 이상)', 6, 0, '흡연/음주'),
-- (5, 2, '예 (하루 반갑)', 6, 3, '흡연/음주'),
-- (5, 3, '예 (가끔)', 6, 7, '흡연/음주'),
-- (5, 4, '아니오 (전혀 안함)', 6, 10, '흡연/음주');

-- -- 설문 응답 옵션 삽입 (문항 6 - 마지막 문항)
-- INSERT INTO survey_question_options (question_number, option_number, option_text, next_question_number, score, category) VALUES
-- (6, 1, '거의 매일', NULL, 0, '흡연/음주'),
-- (6, 2, '주 3-4회', NULL, 3, '흡연/음주'),
-- (6, 3, '주 1-2회', NULL, 6, '흡연/음주'),
-- (6, 4, '월 1-2회', NULL, 8, '흡연/음주'),
-- (6, 5, '거의 안함', NULL, 10, '흡연/음주');

