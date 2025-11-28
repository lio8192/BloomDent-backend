# 🦷 BloomDent Backend API

병원 예약 시스템을 위한 Node.js Express + MariaDB API 서버입니다.

## ✨ 주요 기능

### 👤 사용자 계정
- 사용자 로그인 (bcrypt 암호화)
- 사용자 정보 조회
- 사용자별 예약 목록 관리

### 🏥 치과 정보 관리
- 주변 치과 검색 (위치 기반 - Haversine 공식)
- 치과 검색 (키워드)
- 치과 상세 정보
- 예약 가능한 날짜 및 시간 조회

### 📅 예약 시스템
- 예약 생성 (사전 자가진단 설문 포함)
- 사용자 계정과 연동 (선택 사항)
- 예약 조회 및 관리
- 예약 취소
- 예약 가능한 시간대 관리

### 📋 사전 자가진단 설문
- 예약 시 필요한 설문 질문 관리
- 객관식, 주관식, Yes/No 질문 지원
- 설문 응답 저장 및 조회

### 🖼️ AI 사진 분석
- 치아 사진 업로드 (Cloudinary)
- Flask AI 모델 서버 연동
- 교합, 충치 상태 분석
- 비동기 백그라운드 처리
- 분석 결과 및 추천 사항 제공

### 📋 동적 설문 시스템
- 응답에 따라 다음 문항 자동 라우팅
- 실시간 진행률 계산
- 설문 응답 이력 저장
- 표준화 점수 방식으로 카테고리별 점수 자동 계산
  - 공식: (획득 점수 / 최대 점수) × 100
  - 응답 경로가 달라도 공정하게 비교 가능

### 📊 카테고리별 건강 점수
- 6개 카테고리별 점수 관리
  - 구강관리/양치습관
  - 구치/구강건조
  - 흡연/음주
  - 우식성 식품 섭취
  - 지각과민/불소
  - 구강악습관
- 설문 결과 기반 자동 점수 계산
- 점수 CRUD (생성, 조회, 수정, 삭제)
- 점수 이력 추적
- 리더보드 (순위)

---

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 MariaDB 정보를 입력하세요:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bloomdent_db
```

### 3. 데이터베이스 설정

**방법 1: Node.js 스크립트 사용 (추천)**
```bash
npm run setup-db
```

**방법 2: MySQL/MariaDB 클라이언트 사용**
```bash
# MySQL 클라이언트가 설치되어 있는 경우
chmod +x setup-database.sh
./setup-database.sh
```

**방법 3: 수동 설정**
```bash
# MariaDB 접속
mysql -u root -p

# 데이터베이스 생성
CREATE DATABASE bloomdent_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 스키마 및 샘플 데이터 생성
mysql -u root -p bloomdent_db < database/schema.sql
mysql -u root -p bloomdent_db < database/seed_data.sql
```

### 4. 서버 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

서버가 실행되면: http://localhost:3000

---

## 📡 주요 API 엔드포인트

### 기본
- `GET /` - 서버 상태
- `GET /api/hello` - 기본 API
- `GET /api/hello-db` - DB 연결 테스트

### 사용자
- `POST /api/users/login` - 로그인
- `GET /api/users/:id` - 사용자 정보 조회
- `GET /api/users/:id/appointments` - 사용자 예약 목록

### 치과 정보
- `GET /api/clinics` - 전체 치과 목록
- `GET /api/clinics/nearby` - 주변 치과 검색
- `GET /api/clinics/search` - 키워드 검색
- `GET /api/clinics/:id` - 치과 상세 정보
- `GET /api/clinics/:id/available-dates` - 예약 가능 날짜
- `GET /api/clinics/:id/available-slots` - 예약 가능 시간

### 예약
- `POST /api/appointments` - 예약 생성
- `GET /api/appointments/:id` - 예약 조회
- `GET /api/appointments/patient/:phone` - 전화번호로 예약 목록 조회
- `PUT /api/appointments/:id/cancel` - 예약 취소
- `GET /api/appointments/surveys/questions` - 설문 질문 조회

### 사진 분석
- `POST /api/images/upload` - 사진 업로드 및 분석 요청
- `GET /api/images/:id/status` - 분석 상태 조회
- `GET /api/images/:id/analysis` - 분석 결과 조회
- `GET /api/images/user/:userId` - 사용자 이미지 목록
- `DELETE /api/images/:id` - 이미지 삭제

### 동적 설문
- `GET /api/survey/start` - 설문 시작 (1번 문항 조회)
- `POST /api/survey/answer` - 설문 응답 제출 및 다음 문항 조회
- `POST /api/survey/calculate` - 설문 결과로 점수 계산
- `GET /api/survey/responses/:userId` - 사용자 설문 응답 이력 조회

### 카테고리별 점수
- `GET /api/scores/user/:userId` - 사용자 점수 조회
- `POST /api/scores/user/:userId` - 점수 입력/수정
- `DELETE /api/scores/user/:userId` - 점수 삭제 (초기화)
- `GET /api/scores/user/:userId/history` - 점수 이력 조회
- `GET /api/scores/leaderboard` - 리더보드 조회
- `GET /api/scores/categories` - 카테고리 목록 조회

**📚 상세한 API 문서:**
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - 전체 API 명세
- [API_USER_GUIDE.md](./API_USER_GUIDE.md) - 사용자 계정 API 가이드
- [API_IMAGE_ANALYSIS.md](./API_IMAGE_ANALYSIS.md) - 사진 분석 API 가이드
- [API_SURVEY_SCORES.md](./API_SURVEY_SCORES.md) - 동적 설문 & 점수 API 가이드

---

## 📁 프로젝트 구조
```
BloomDent-backend/
├── config/
│   └── database.js           # MariaDB 연결 설정
├── database/
│   ├── schema.sql            # 데이터베이스 스키마
│   └── seed_data.sql         # 샘플 데이터
├── routes/
│   ├── api.js                # 기본 API
│   ├── users.js              # 사용자 계정 API
│   ├── clinics.js            # 치과 정보 API
│   └── appointments.js       # 예약 API
├── utils/
│   └── hash-password.js      # 비밀번호 해싱 유틸리티
├── .env                      # 환경 변수
├── .gitignore
├── package.json
├── server.js                 # 메인 서버
├── setup-database.js         # DB 설정 스크립트 (Node.js)
├── setup-database.sh         # DB 설정 스크립트 (Bash)
├── README.md                 # 이 파일
├── API_DOCUMENTATION.md      # API 상세 문서
└── API_USER_GUIDE.md         # 사용자 계정 API 가이드
```

---

## 🗄️ 데이터베이스 구조

### 주요 테이블
- **users** - 사용자 계정 (bcrypt 암호화)
- **dental_clinics** - 치과 병원 정보
- **appointment_slots** - 예약 가능 시간 슬롯
- **appointments** - 예약 정보 (user_id 참조)
- **survey_questions** - 사전 자가진단 설문
- **appointment_surveys** - 예약별 설문 응답
- **dental_images** - 치아 사진 (Cloudinary)
- **image_analysis** - 사진 분석 결과
- **survey_questions_master** - 설문 문항
- **survey_question_options** - 설문 응답 옵션
- **user_survey_responses** - 사용자 설문 응답
- **user_health_scores** - 사용자 카테고리별 건강 점수
- **score_history** - 점수 변화 이력

---

## 🔧 기술 스택

### Backend
- **Node.js** - JavaScript 런타임
- **Express** - 웹 프레임워크
- **MySQL2** - MariaDB/MySQL 드라이버

### Database
- **MariaDB** - 관계형 데이터베이스

### 보안 & 유틸리티
- **bcrypt** - 비밀번호 암호화
- **helmet** - 보안 헤더
- **cors** - CORS 설정
- **morgan** - HTTP 로깅
- **dotenv** - 환경 변수 관리

---

## 🧪 테스트 예제

### 테스트 계정
- 아이디: `user1`, 비밀번호: `password123`
- 아이디: `user2`, 비밀번호: `password123`
- 아이디: `test`, 비밀번호: `password123`

### cURL로 API 테스트

```bash
# 서버 상태 확인
curl http://localhost:3000

# 로그인
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'

# 주변 치과 검색 (강남역 기준)
curl "http://localhost:3000/api/clinics/nearby?latitude=37.5012767&longitude=127.0396597&radius=5"

# 설문 질문 조회
curl http://localhost:3000/api/appointments/surveys/questions

# 치과 상세 정보
curl http://localhost:3000/api/clinics/1

# 예약 가능 시간 조회
curl "http://localhost:3000/api/clinics/1/available-slots?date=2025-11-11"

# 예약 생성 (로그인한 사용자)
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "clinic_id": 1,
    "slot_id": 3,
    "patient_name": "홍길동",
    "patient_phone": "010-1234-5678",
    "patient_email": "hong@example.com",
    "symptoms": "치아 통증",
    "survey_answers": [
      {"question_id": 1, "answer": "yes"},
      {"question_id": 2, "answer": "no"}
    ]
  }'

# 사용자 예약 목록 조회
curl http://localhost:3000/api/users/1/appointments
```

---

## 📖 API 문서

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - 전체 API 명세서
- **[API_USER_GUIDE.md](./API_USER_GUIDE.md)** - 사용자 계정 API 가이드

---

## 🚀 배포

### GitHub Actions (자동 배포)

`main` 브랜치에 push하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "feat: 새로운 기능"
git push origin main
```

### 수동 배포

```bash
# 배포 스크립트 실행
npm run deploy

# 또는
./deploy.sh
```

**📚 상세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.**

---

## 💡 참고사항

- 환경 변수 파일(`.env`)은 절대 공개 저장소에 커밋하지 마세요!
- 샘플 데이터는 서울 강남 지역 기준으로 작성되어 있습니다.
- 위치 기반 검색은 Haversine 공식을 사용하여 거리를 계산합니다.
- 예약 생성 시 트랜잭션을 사용하여 데이터 일관성을 보장합니다.
- 프로덕션 환경에서는 PM2를 사용하여 프로세스를 관리하세요.
