# 🦷 BloomDent API 문서

## 📋 목차
- [기본 정보](#기본-정보)
- [치과 정보 API](#치과-정보-api)
- [예약 시스템 API](#예약-시스템-api)

---

## 기본 정보

**Base URL**: `http://localhost:3000`

**응답 형식**: JSON

**공통 응답 구조**:
```json
{
  "success": true/false,
  "message": "메시지",
  "data": {}
}
```

---

## 치과 정보 API

### 1. 모든 치과 목록 조회
**GET** `/api/clinics`

**응답 예시**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "name": "서울밝은치과",
      "latitude": "37.50127670",
      "longitude": "127.03965970",
      "address": "서울특별시 강남구 테헤란로 123",
      "phone": "02-1234-5678",
      "description": "첨단 장비를 갖춘 종합 치과입니다.",
      "is_partner": 1,
      "created_at": "2025-11-10T12:00:00.000Z",
      "updated_at": "2025-11-10T12:00:00.000Z"
    }
  ]
}
```

**참고사항**:
- `is_partner`: 협약 병원 여부 (1: 협약 병원, 0: 비협약 병원)
  - 협약 병원(`is_partner: 1`): 앱을 통한 온라인 예약 가능
  - 비협약 병원(`is_partner: 0`): 전화 예약만 가능

---

### 2. 주변 치과 검색 (위치 기반)
**GET** `/api/clinics/nearby`

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| latitude | number | ✅ | 현재 위치의 위도 | - |
| longitude | number | ✅ | 현재 위치의 경도 | - |
| radius | number | ❌ | 검색 반경 (km) | 5 |
| limit | number | ❌ | 최대 결과 개수 | 100 |

**요청 예시**:
```
GET /api/clinics/nearby?latitude=37.5012767&longitude=127.0396597&radius=5&limit=50
```

**응답 예시**:
```json
{
  "success": true,
  "count": 3,
  "searchLocation": {
    "latitude": 37.5012767,
    "longitude": 127.0396597,
    "radius": 5
  },
  "data": [
    {
      "id": 1,
      "name": "서울밝은치과",
      "latitude": "37.50127670",
      "longitude": "127.03965970",
      "address": "서울특별시 강남구 테헤란로 123",
      "phone": "02-1234-5678",
      "description": "첨단 장비를 갖춘 종합 치과입니다.",
      "is_partner": 1,
      "distance": 0.12
    }
  ]
}
```

**참고사항**:
- MySQL의 `ST_Distance_Sphere` 함수를 사용하여 DB 레벨에서 거리 계산 (고성능)
- 거리는 km 단위로 반올림되어 소수점 2자리까지 표시됩니다
- 결과는 거리순으로 정렬되어 반환됩니다

---

### 3. 치과 이름/주소 검색
**GET** `/api/clinics/search`

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| keyword | string | ✅ | 검색어 (이름 또는 주소) |

**요청 예시**:
```
GET /api/clinics/search?keyword=강남
```

**응답 예시**:
```json
{
  "success": true,
  "count": 2,
  "keyword": "강남",
  "data": [...]
}
```

---

### 4. 치과 상세 정보 조회
**GET** `/api/clinics/:id`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| id | number | 치과 ID |

**요청 예시**:
```
GET /api/clinics/1
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "서울밝은치과",
    "latitude": "37.50127670",
    "longitude": "127.03965970",
    "address": "서울특별시 강남구 테헤란로 123",
    "phone": "02-1234-5678",
    "description": "첨단 장비를 갖춘 종합 치과입니다.",
    "is_partner": 1
  }
}
```

**참고사항**:
- `is_partner`: 협약 병원 여부 (1: 협약 병원, 0: 비협약 병원)

---

### 5. 예약 가능한 날짜 조회
**GET** `/api/clinics/:id/available-dates`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| id | number | 치과 ID |

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| from_date | date | ❌ | 검색 시작 날짜 (YYYY-MM-DD) | 오늘 |
| to_date | date | ❌ | 검색 종료 날짜 (YYYY-MM-DD) | 오늘+30일 |

**요청 예시**:
```
GET /api/clinics/1/available-dates?from_date=2025-11-11&to_date=2025-11-20
```

**응답 예시**:
```json
{
  "success": true,
  "clinic_id": 1,
  "count": 5,
  "data": [
    "2025-11-11",
    "2025-11-12",
    "2025-11-13"
  ]
}
```

---

### 6. 특정 날짜의 예약 가능한 시간 조회
**GET** `/api/clinics/:id/available-slots`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| id | number | 치과 ID |

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | date | ✅ | 날짜 (YYYY-MM-DD) |

**요청 예시**:
```
GET /api/clinics/1/available-slots?date=2025-11-11
```

**응답 예시**:
```json
{
  "success": true,
  "clinic_id": 1,
  "date": "2025-11-11",
  "count": 8,
  "data": [
    {
      "id": 1,
      "time_slot": "09:00:00",
      "is_available": true
    },
    {
      "id": 2,
      "time_slot": "10:00:00",
      "is_available": true
    }
  ]
}
```

---

## 예약 시스템 API

### 1. 사전 자가진단 설문 질문 조회
**GET** `/api/appointments/surveys/questions`

**응답 예시**:
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": 1,
      "question": "현재 치아에 통증이 있으신가요?",
      "question_type": "yes_no",
      "options": null,
      "order_num": 1,
      "is_active": true,
      "created_at": "2025-11-10T12:00:00.000Z"
    },
    {
      "id": 7,
      "question": "방문 목적을 선택해주세요.",
      "question_type": "multiple_choice",
      "options": ["정기 검진", "충치 치료", "잇몸 치료", "임플란트", "교정", "기타"],
      "order_num": 7,
      "is_active": true,
      "created_at": "2025-11-10T12:00:00.000Z"
    }
  ]
}
```

---

### 2. 예약 생성
**POST** `/api/appointments`

**Request Body**:
```json
{
  "user_id": 1,
  "clinic_id": 1,
  "slot_id": 3,
  "patient_name": "홍길동",
  "patient_phone": "010-1234-5678",
  "patient_email": "hong@example.com",
  "patient_birth_date": "1990-01-01",
  "symptoms": "치아가 시린 증상이 있습니다.",
  "survey_answers": [
    {
      "question_id": 1,
      "answer": "yes"
    },
    {
      "question_id": 2,
      "answer": "no"
    },
    {
      "question_id": 7,
      "answer": "충치 치료"
    }
  ]
}
```

**필수 필드**:
- `clinic_id`: 치과 ID
- `slot_id`: 예약 시간 슬롯 ID
- `patient_name`: 예약자 이름
- `patient_phone`: 예약자 전화번호

**선택 필드**:
- `user_id`: 로그인한 사용자 ID (선택 사항, 로그인하지 않은 사용자도 예약 가능)
- `patient_email`: 예약자 이메일
- `patient_birth_date`: 생년월일 (YYYY-MM-DD)
- `symptoms`: 증상 설명
- `survey_answers`: 사전 자가진단 설문 응답 배열

**주의사항**:
- **협약 병원(`is_partner: 1`)만 온라인 예약이 가능합니다**
- 비협약 병원(`is_partner: 0`)은 전화 예약만 가능합니다
- 예약 생성 시 해당 시간 슬롯이 자동으로 예약 불가능 상태로 변경됩니다

**응답 예시**:
```json
{
  "success": true,
  "message": "예약이 성공적으로 생성되었습니다.",
  "data": {
    "id": 3,
    "user_id": 1,
    "clinic_id": 1,
    "slot_id": 3,
    "patient_name": "홍길동",
    "patient_phone": "010-1234-5678",
    "patient_email": "hong@example.com",
    "patient_birth_date": "1990-01-01",
    "symptoms": "치아가 시린 증상이 있습니다.",
    "status": "pending",
    "clinic_name": "서울밝은치과",
    "clinic_address": "서울특별시 강남구 테헤란로 123",
    "clinic_phone": "02-1234-5678",
    "appointment_date": "2025-11-11",
    "appointment_time": "11:00:00",
    "created_at": "2025-11-10T15:30:00.000Z"
  }
}
```

**에러 응답 (400)**:
```json
{
  "success": false,
  "message": "해당 시간은 이미 예약되었거나 존재하지 않습니다."
}
```

---

### 3. 예약 상세 조회
**GET** `/api/appointments/:id`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| id | number | 예약 ID |

**요청 예시**:
```
GET /api/appointments/1
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "clinic_id": 1,
    "slot_id": 1,
    "patient_name": "김철수",
    "patient_phone": "010-1111-2222",
    "patient_email": "kim@example.com",
    "patient_birth_date": "1990-05-15",
    "symptoms": "치아 통증이 있습니다.",
    "status": "confirmed",
    "clinic_name": "서울밝은치과",
    "clinic_address": "서울특별시 강남구 테헤란로 123",
    "clinic_phone": "02-1234-5678",
    "latitude": "37.50127670",
    "longitude": "127.03965970",
    "appointment_date": "2025-11-11",
    "appointment_time": "09:00:00",
    "created_at": "2025-11-10T12:00:00.000Z",
    "updated_at": "2025-11-10T12:00:00.000Z",
    "survey_answers": [
      {
        "id": 1,
        "question_id": 1,
        "question": "현재 치아에 통증이 있으신가요?",
        "question_type": "yes_no",
        "answer": "yes"
      }
    ]
  }
}
```

---

### 4. 전화번호로 예약 목록 조회
**GET** `/api/appointments/patient/:phone`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| phone | string | 예약자 전화번호 |

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| status | string | ❌ | 예약 상태 필터 (pending/confirmed/completed/cancelled) |

**요청 예시**:
```
GET /api/appointments/patient/010-1111-2222
GET /api/appointments/patient/010-1111-2222?status=confirmed
```

**응답 예시**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "clinic_id": 1,
      "slot_id": 1,
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

---

### 5. 예약 취소
**PUT** `/api/appointments/:id/cancel`

**Path Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| id | number | 예약 ID |

**요청 예시**:
```
PUT /api/appointments/1/cancel
```

**응답 예시**:
```json
{
  "success": true,
  "message": "예약이 취소되었습니다.",
  "data": {
    "id": 1,
    "status": "cancelled"
  }
}
```

**참고사항**:
- 예약 취소 시 해당 시간 슬롯이 자동으로 다시 예약 가능 상태로 변경됩니다
- 이미 취소된 예약을 다시 취소하려고 하면 에러가 발생합니다

---

## 에러 응답

모든 API는 에러 발생 시 다음 형식으로 응답합니다:

```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 내용 (개발 모드에서만)"
}
```

**HTTP 상태 코드**:
- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 내부 오류
- `503`: 서비스 이용 불가 (DB 연결 실패 등)

---

## 예약 상태 (status)

| 상태 | 설명 |
|------|------|
| pending | 예약 대기 중 |
| confirmed | 예약 확정 |
| completed | 진료 완료 |
| cancelled | 예약 취소 |

