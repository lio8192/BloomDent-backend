# 📋 동적 설문 & 점수 API 문서

## 📋 목차
- [개요](#개요)
- [시스템 구조](#시스템-구조)
- [설문 API](#설문-api)
- [점수 API](#점수-api)
- [데이터베이스 구조](#데이터베이스-구조)

---

## 개요

동적 라우팅 설문 시스템과 카테고리별 점수 관리 API입니다.

### 주요 기능
- ✅ 동적 설문 라우팅 (응답에 따라 다음 문항 결정)
- ✅ 실시간 진행률 계산
- ✅ 카테고리별 점수 자동 계산
- ✅ 점수 CRUD (생성, 조회, 수정, 삭제)
- ✅ 설문 응답 이력 저장
- ✅ 점수 변화 이력 추적

### 6개 점수 카테고리
1. **구강관리/양치습관**
2. **구치/구강건조**
3. **흡연/음주**
4. **우식성 식품 섭취**
5. **지각과민/불소**
6. **구강악습관**

---

## 시스템 구조

```
[클라이언트]
    ↓ 1. 설문 시작 (GET /api/survey/start)
[Node.js API]
    ↓ 2. 1번 문항 + 옵션 + 세션ID 반환
[클라이언트]
    ↓ 3. 응답 제출 (POST /api/survey/answer)
[Node.js API]
    ↓ 4. 응답 저장 + 다음 문항 반환
[반복...]
    ↓ 5. 설문 완료 (next_question_number = NULL)
[클라이언트]
    ↓ 6. 점수 계산 요청 (POST /api/survey/calculate)
[Node.js API]
    ↓ 7. 카테고리별 점수 계산 및 저장
[MariaDB]
```

---

## 설문 API

### 1. 설문 시작

**GET** `/api/survey/start`

설문을 시작하고 1번 문항을 조회합니다.

**요청 예시**:
```bash
curl http://localhost:3000/api/survey/start
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
    "current_question": {
      "question_number": 1,
      "question_text": "양치질만으로는 구강관리가 부족하다는 것을 알고 계십니까?",
      "max_score": 3.75
    },
    "options": [
      {
        "option_number": 1,
        "option_text": "매우 그렇다",
        "next_question_number": 2,
        "score": 5.00,
        "category": "구강관리/양치습관"
      },
      {
        "option_number": 2,
        "option_text": "그렇다",
        "next_question_number": 2,
        "score": 4.00,
        "category": "구강관리/양치습관"
      },
      {
        "option_number": 3,
        "option_text": "보통이다",
        "next_question_number": 2,
        "score": 3.00,
        "category": "구강관리/양치습관"
      }
    ],
    "progress": {
      "current": 1,
      "total": 6,
      "remaining": 5
    }
  }
}
```

---

### 2. 설문 응답 제출

**POST** `/api/survey/answer`

설문 응답을 제출하고 다음 문항을 조회합니다.

**요청 본문**:
```json
{
  "user_id": 1,
  "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
  "question_number": 1,
  "option_number": 1
}
```

**필수 필드**:
- `user_id`: 사용자 ID
- `session_id`: 설문 세션 ID (start API에서 받은 값)
- `question_number`: 현재 문항 번호
- `option_number`: 선택한 응답 번호

**요청 예시**:
```bash
curl -X POST http://localhost:3000/api/survey/answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
    "question_number": 1,
    "option_number": 1
  }'
```

**성공 응답 - 진행 중 (200)**:
```json
{
  "success": true,
  "data": {
    "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
    "answered_option": {
      "option_number": 1,
      "option_text": "매우 그렇다",
      "score": 5.00,
      "category": "구강관리/양치습관"
    },
    "next_question": {
      "question_number": 2,
      "question_text": "본인에게 알맞은 구강관리용품이 무엇인지 알고 계십니까?",
      "max_score": 3.75
    },
    "options": [
      {
        "option_number": 1,
        "option_text": "매우 잘 알고 있다",
        "next_question_number": 3,
        "score": 5.00,
        "category": "구강관리/양치습관"
      }
    ],
    "is_completed": false,
    "progress": {
      "current": 2,
      "total": 6,
      "remaining": 4
    }
  }
}
```

**성공 응답 - 설문 완료 (200)**:
```json
{
  "success": true,
  "data": {
    "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
    "answered_option": {
      "option_number": 5,
      "option_text": "거의 안함",
      "score": 10.00,
      "category": "흡연/음주"
    },
    "is_completed": true,
    "progress": {
      "current": 6,
      "total": 6,
      "remaining": 0
    },
    "message": "설문이 완료되었습니다. /api/survey/calculate를 호출하여 점수를 계산하세요."
  }
}
```

---

### 3. 설문 결과로 점수 계산

**POST** `/api/survey/calculate`

설문 응답을 기반으로 카테고리별 점수를 계산하고 저장합니다.

**요청 본문**:
```json
{
  "user_id": 1,
  "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6"
}
```

**요청 예시**:
```bash
curl -X POST http://localhost:3000/api/survey/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6"
  }'
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "점수가 계산되어 저장되었습니다.",
  "data": {
    "total_score": 78.50,
    "categories": {
      "구강관리/양치습관": 85.00,
      "구치/구강건조": 75.00,
      "흡연/음주": 90.00,
      "우식성 식품 섭취": 70.00,
      "지각과민/불소": 80.00,
      "구강악습관": 71.00
    },
    "calculation_details": {
      "total_earned": 39.0,
      "total_max": 49.75,
      "formula": "(획득 점수 / 최대 점수) × 100"
    }
  }
}
```

---

### 4. 사용자 설문 응답 이력 조회

**GET** `/api/survey/responses/:userId`

사용자의 설문 응답 이력을 조회합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| session_id | string | ❌ | 특정 세션의 응답만 조회 |

**요청 예시**:
```bash
# 전체 응답
curl http://localhost:3000/api/survey/responses/1

# 특정 세션
curl "http://localhost:3000/api/survey/responses/1?session_id=a1b2c3d4"
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": 1,
      "survey_session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
      "question_number": 1,
      "question_text": "양치질만으로는 구강관리가 부족하다는 것을 알고 계십니까?",
      "option_number": 1,
      "option_text": "매우 그렇다",
      "score": 5.00,
      "category": "구강관리/양치습관",
      "answered_at": "2025-11-11T10:00:00.000Z"
    }
  ]
}
```

---

## 점수 API

### 1. 사용자 점수 조회

**GET** `/api/scores/user/:userId`

사용자의 현재 카테고리별 점수를 조회합니다.

**요청 예시**:
```bash
curl http://localhost:3000/api/scores/user/1
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "user_name": "김철수",
    "total_score": 78.50,
    "categories": {
      "구강관리/양치습관": 85.00,
      "구치/구강건조": 75.00,
      "흡연/음주": 90.00,
      "우식성 식품 섭취": 70.00,
      "지각과민/불소": 80.00,
      "구강악습관": 71.00
    },
    "last_survey_session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
    "last_survey_date": "2025-11-11T10:30:00.000Z",
    "updated_at": "2025-11-11T10:30:00.000Z"
  }
}
```

---

### 2. 점수 입력/수정

**POST** `/api/scores/user/:userId`

점수를 직접 입력하거나 수정합니다.

**요청 본문**:
```json
{
  "category_scores": {
    "구강관리/양치습관": 85.0,
    "구치/구강건조": 75.0,
    "흡연/음주": 90.0,
    "우식성 식품 섭취": 70.0,
    "지각과민/불소": 80.0,
    "구강악습관": 71.0
  },
  "session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6"
}
```

**요청 예시**:
```bash
curl -X POST http://localhost:3000/api/scores/user/1 \
  -H "Content-Type: application/json" \
  -d '{
    "category_scores": {
      "구강관리/양치습관": 85.0,
      "구치/구강건조": 75.0,
      "흡연/음주": 90.0,
      "우식성 식품 섭취": 70.0,
      "지각과민/불소": 80.0,
      "구강악습관": 71.0
    }
  }'
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "점수가 저장되었습니다.",
  "data": {
    "total_score": 78.50,
    "categories": {
      "구강관리/양치습관": 85.00,
      "구치/구강건조": 75.00,
      "흡연/음주": 90.00,
      "우식성 식품 섭취": 70.00,
      "지각과민/불소": 80.00,
      "구강악습관": 71.00
    }
  }
}
```

---

### 3. 점수 삭제 (초기화)

**DELETE** `/api/scores/user/:userId`

사용자의 점수를 초기화합니다.

**요청 예시**:
```bash
curl -X DELETE http://localhost:3000/api/scores/user/1
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "점수가 초기화되었습니다."
}
```

---

### 4. 점수 이력 조회

**GET** `/api/scores/user/:userId/history`

점수 변화 이력을 조회합니다.

**요청 예시**:
```bash
curl http://localhost:3000/api/scores/user/1/history?limit=10
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "total": 5,
    "limit": 10,
    "offset": 0,
    "history": [
      {
        "id": 5,
        "total_score": 78.50,
        "oral_care_score": 85.00,
        "cavity_dryness_score": 75.00,
        "smoking_drinking_score": 90.00,
        "cariogenic_food_score": 70.00,
        "sensitivity_fluoride_score": 80.00,
        "oral_habits_score": 71.00,
        "score_type": "survey",
        "survey_session_id": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
        "created_at": "2025-11-11T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 5. 리더보드 조회

**GET** `/api/scores/leaderboard`

**요청 예시**:
```bash
curl http://localhost:3000/api/scores/leaderboard?limit=10
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "user_id": 3,
      "user_name": "박지성",
      "total_score": 92.50,
      "last_survey_date": "2025-11-11T12:00:00.000Z",
      "updated_at": "2025-11-11T12:00:00.000Z"
    }
  ]
}
```

---

### 6. 카테고리 목록 조회

**GET** `/api/scores/categories`

**요청 예시**:
```bash
curl http://localhost:3000/api/scores/categories
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "categories": [
      "구강관리/양치습관",
      "구치/구강건조",
      "흡연/음주",
      "우식성 식품 섭취",
      "지각과민/불소",
      "구강악습관"
    ]
  }
}
```

---

## 데이터베이스 구조

### survey_questions_master (설문 문항)
```sql
- question_number: 문항번호 (1, 2, 3...)
- question_text: 문항내용
- max_score: 문항당배점
```

### survey_question_options (설문 응답 옵션)
```sql
- question_number: 문항번호
- option_number: 응답번호
- option_text: 응답내용
- next_question_number: 다음문항 (NULL이면 종료)
- score: 배점
- category: 카테고리
```

### user_survey_responses (사용자 설문 응답)
```sql
- user_id: 사용자 ID
- survey_session_id: 설문 세션 ID
- question_number: 문항번호
- option_number: 응답번호
- score: 획득 점수
- category: 카테고리
- answered_at: 응답 시간
```

### user_health_scores (사용자 점수)
```sql
- user_id: 사용자 ID
- total_score: 총점
- oral_care_score: 구강관리/양치습관
- cavity_dryness_score: 구치/구강건조
- smoking_drinking_score: 흡연/음주
- cariogenic_food_score: 우식성 식품 섭취
- sensitivity_fluoride_score: 지각과민/불소
- oral_habits_score: 구강악습관
```

---

## 점수 계산 로직

### 표준화 점수 방식

응답 문항 수가 달라도 공정하게 비교할 수 있는 표준화 점수를 사용합니다.

**공식**:
```javascript
사용자 점수 = (획득 점수 / 해당 경로 총 배점) × 100
```

### 계산 방식

#### 1. 카테고리별 점수 계산
```javascript
카테고리 점수 = (해당 카테고리에서 획득한 점수 합계 / 해당 카테고리 최대 점수 합계) × 100
```

#### 2. 총점 계산
```javascript
총점 = (전체 획득 점수 합계 / 전체 최대 점수 합계) × 100
```

### 예시 1: 기본 경로

사용자 A가 다음과 같이 응답한 경우:
- 문항 1 (최대: 3.75점): 5점 획득
- 문항 2 (최대: 3.75점): 4점 획득
- 문항 3 (최대: 3.75점): 5점 획득
- 문항 4 (최대: 5.00점): 7점 획득
- 문항 5 (최대: 10.00점): 10점 획득
- 문항 6 (최대: 8.00점): 8점 획득

**카테고리별 계산**:
- **구강관리/양치습관**: 
  - 획득: 5 + 4 + 5 + 7 = 21점
  - 최대: 3.75 + 3.75 + 3.75 + 5.00 = 16.25점
  - 점수: (21 / 16.25) × 100 = **129.23점** (최대 100점으로 제한 가능)
  
- **흡연/음주**: 
  - 획득: 10 + 8 = 18점
  - 최대: 10.00 + 8.00 = 18점
  - 점수: (18 / 18) × 100 = **100.00점**

- **총점**: 
  - 전체 획득: 21 + 18 = 39점
  - 전체 최대: 16.25 + 18 = 34.25점
  - 점수: (39 / 34.25) × 100 = **113.87점**

### 예시 2: 다른 경로

사용자 B가 다른 경로로 응답한 경우:
- 문항 1 (최대: 3.75점): 3점 획득
- 문항 2 (최대: 3.75점): 3점 획득
- 문항 5 (최대: 10.00점): 7점 획득
- 문항 6 (최대: 8.00점): 6점 획득

**카테고리별 계산**:
- **구강관리/양치습관**: 
  - 획득: 3 + 3 = 6점
  - 최대: 3.75 + 3.75 = 7.5점
  - 점수: (6 / 7.5) × 100 = **80.00점**
  
- **흡연/음주**: 
  - 획득: 7 + 6 = 13점
  - 최대: 10.00 + 8.00 = 18점
  - 점수: (13 / 18) × 100 = **72.22점**

- **총점**: 
  - 전체 획득: 6 + 13 = 19점
  - 전체 최대: 7.5 + 18 = 25.5점
  - 점수: (19 / 25.5) × 100 = **74.51점**

### 장점

✅ **공정성**: 응답한 문항 수가 달라도 동일한 기준으로 비교  
✅ **표준화**: 모든 점수가 0-100 범위로 정규화  
✅ **비교 가능**: 다른 사용자와 직접 비교 가능

---

## 완전한 사용 플로우

### 1. 설문 시작
```bash
curl http://localhost:3000/api/survey/start
```
→ `session_id` 저장

### 2. 설문 응답 (반복)
```bash
curl -X POST http://localhost:3000/api/survey/answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_id": "저장한_세션_ID",
    "question_number": 1,
    "option_number": 1
  }'
```
→ `is_completed: false`이면 다음 문항 계속 진행

### 3. 설문 완료 후 점수 계산
```bash
curl -X POST http://localhost:3000/api/survey/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "session_id": "저장한_세션_ID"
  }'
```

### 4. 점수 확인
```bash
curl http://localhost:3000/api/scores/user/1
```

---

## JavaScript 클라이언트 예시

```javascript
class SurveyManager {
  constructor(userId) {
    this.userId = userId;
    this.sessionId = null;
    this.currentQuestion = null;
  }

  // 1. 설문 시작
  async start() {
    const response = await fetch('http://localhost:3000/api/survey/start');
    const data = await response.json();
    
    this.sessionId = data.data.session_id;
    this.currentQuestion = data.data.current_question;
    
    return data.data;
  }

  // 2. 응답 제출
  async answer(questionNumber, optionNumber) {
    const response = await fetch('http://localhost:3000/api/survey/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        session_id: this.sessionId,
        question_number: questionNumber,
        option_number: optionNumber
      })
    });
    
    const data = await response.json();
    
    if (data.data.is_completed) {
      // 설문 완료 - 자동으로 점수 계산
      return await this.calculateScore();
    }
    
    this.currentQuestion = data.data.next_question;
    return data.data;
  }

  // 3. 점수 계산
  async calculateScore() {
    const response = await fetch('http://localhost:3000/api/survey/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        session_id: this.sessionId
      })
    });
    
    return await response.json();
  }

  // 4. 점수 조회
  async getScore() {
    const response = await fetch(`http://localhost:3000/api/scores/user/${this.userId}`);
    return await response.json();
  }
}

// 사용 예시
const survey = new SurveyManager(1);

// 시작
const startData = await survey.start();
console.log('첫 문항:', startData.current_question);
console.log('진행률:', startData.progress);

// 응답
const result = await survey.answer(1, 1);
if (result.is_completed) {
  console.log('설문 완료! 점수:', result.data);
} else {
  console.log('다음 문항:', result.next_question);
}
```

---

## 에러 응답

| HTTP 상태 | 설명 |
|-----------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (필수 필드 누락) |
| 404 | 리소스를 찾을 수 없음 |
| 500 | 서버 내부 오류 |

