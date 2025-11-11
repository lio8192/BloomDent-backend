# 🔐 사용자 계정 API 가이드

## 📋 목차
- [계정 정보](#계정-정보)
- [로그인 API](#로그인-api)
- [사용자 정보 조회](#사용자-정보-조회)
- [사용자 예약 목록](#사용자-예약-목록)

---

## 계정 정보

### 테스트 계정

| 아이디 | 비밀번호 | 이름 |
|--------|---------|------|
| user1 | password123 | 김철수 |
| user2 | password123 | 이영희 |
| test | password123 | 테스트 |

---

## 로그인 API

### POST `/api/users/login`

사용자 로그인을 수행합니다.

**요청 본문**:
```json
{
  "username": "user1",
  "password": "password123"
}
```

**필수 필드**:
- `username`: 아이디
- `password`: 비밀번호

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "로그인 성공",
  "data": {
    "user": {
      "id": 1,
      "username": "user1",
      "name": "김철수",
      "phone": "010-1111-2222",
      "email": "kim@example.com",
      "created_at": "2025-11-10T12:00:00.000Z",
      "updated_at": "2025-11-10T12:00:00.000Z"
    }
  }
}
```

**실패 응답 (401)**:
```json
{
  "success": false,
  "message": "아이디 또는 비밀번호가 일치하지 않습니다."
}
```

**cURL 예제**:
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "password": "password123"
  }'
```

---

## 사용자 정보 조회

### GET `/api/users/:id`

특정 사용자의 정보를 조회합니다.

**경로 파라미터**:
- `id`: 사용자 ID

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "user1",
    "name": "김철수",
    "phone": "010-1111-2222",
    "email": "kim@example.com",
    "created_at": "2025-11-10T12:00:00.000Z"
  }
}
```

**실패 응답 (404)**:
```json
{
  "success": false,
  "message": "사용자를 찾을 수 없습니다."
}
```

**cURL 예제**:
```bash
curl http://localhost:3000/api/users/1
```

---

## 사용자 예약 목록

### GET `/api/users/:id/appointments`

특정 사용자의 예약 목록을 조회합니다.

**경로 파라미터**:
- `id`: 사용자 ID

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| status | string | ❌ | 예약 상태 필터 (pending/confirmed/completed/cancelled) |

**성공 응답 (200)**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "clinic_id": 1,
      "patient_name": "김철수",
      "patient_phone": "010-1111-2222",
      "patient_email": "kim@example.com",
      "patient_birth_date": "1990-05-15",
      "symptoms": "치아 통증이 있습니다.",
      "status": "confirmed",
      "clinic_name": "서울밝은치과",
      "clinic_address": "서울특별시 강남구 테헤란로 123",
      "clinic_phone": "02-1234-5678",
      "appointment_date": "2025-11-11",
      "appointment_time": "09:00:00",
      "created_at": "2025-11-10T12:00:00.000Z",
      "updated_at": "2025-11-10T12:00:00.000Z"
    }
  ]
}
```

**cURL 예제**:
```bash
# 전체 예약 목록
curl http://localhost:3000/api/users/1/appointments

# 확정된 예약만 조회
curl http://localhost:3000/api/users/1/appointments?status=confirmed
```

---

## 예약 시 사용자 ID 포함하기

예약 생성 시 `user_id`를 포함하면 해당 사용자와 연결됩니다.

### POST `/api/appointments`

**요청 본문**:
```json
{
  "user_id": 1,
  "clinic_id": 1,
  "slot_id": 3,
  "patient_name": "김철수",
  "patient_phone": "010-1111-2222",
  "patient_email": "kim@example.com",
  "patient_birth_date": "1990-05-15",
  "symptoms": "치아가 시립니다.",
  "survey_answers": [
    {"question_id": 1, "answer": "yes"},
    {"question_id": 2, "answer": "no"}
  ]
}
```

**참고**:
- `user_id`는 선택 사항입니다.
- 로그인하지 않은 사용자도 예약할 수 있습니다 (user_id 없이).
- 로그인한 사용자는 user_id를 포함하여 예약 이력을 관리할 수 있습니다.

---

## 완전한 로그인 + 예약 플로우

### 1단계: 로그인
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
```

**응답에서 user.id 확인**: 예) `"id": 1`

### 2단계: 설문 질문 조회
```bash
curl http://localhost:3000/api/appointments/surveys/questions
```

### 3단계: 예약 가능한 시간 조회
```bash
curl "http://localhost:3000/api/clinics/1/available-slots?date=2025-11-11"
```

**응답에서 slot id 확인**: 예) `"id": 3`

### 4단계: 예약 생성 (user_id 포함)
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "clinic_id": 1,
    "slot_id": 3,
    "patient_name": "김철수",
    "patient_phone": "010-1111-2222",
    "patient_email": "kim@example.com",
    "symptoms": "치아 통증",
    "survey_answers": [
      {"question_id": 1, "answer": "yes"}
    ]
  }'
```

### 5단계: 내 예약 목록 확인
```bash
curl http://localhost:3000/api/users/1/appointments
```

---

## 보안 고려사항

### 현재 구현
✅ bcrypt를 사용한 비밀번호 해싱  
✅ 로그인 시 비밀번호 검증  
✅ 응답에서 비밀번호 제외  

### 추가 권장사항 (프로덕션)
- JWT 토큰 기반 인증
- 세션 관리
- 비밀번호 재설정 기능
- 이메일 인증
- Rate Limiting
- HTTPS 사용

---

## 에러 응답

| HTTP 상태 | 설명 |
|-----------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (필수 필드 누락) |
| 401 | 인증 실패 (아이디/비밀번호 불일치) |
| 404 | 사용자를 찾을 수 없음 |
| 500 | 서버 내부 오류 |

