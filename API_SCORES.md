# 📊 종합 건강 점수 API 문서

## 📋 목차
- [개요](#개요)
- [점수 계산 시스템](#점수-계산-시스템)
- [API 엔드포인트](#api-엔드포인트)
- [데이터베이스 구조](#데이터베이스-구조)

---

## 개요

사용자의 치아 건강 상태를 종합적으로 평가하는 점수 시스템입니다.

### 점수 구성 요소
- **종합 점수 (Overall Score)**: 0-100점
- **치아 분석 점수 (Analysis Score)**: 0-100점 (AI 분석 결과 기반)
- **설문 점수 (Survey Score)**: 0-100점 (예약 설문 결과 기반)

### 주요 기능
- ✅ 사용자별 종합 점수 관리
- ✅ 점수 이력 추적
- ✅ 통계 및 대시보드 데이터
- ✅ 리더보드 (순위)
- ✅ 자동 통계 업데이트

---

## 점수 계산 시스템

### 현재 구조
점수 계산 로직은 추후 추가 예정이며, 현재는 다음 데이터를 기반으로 합니다:

1. **치아 분석 점수**
   - 완료된 이미지 분석 결과
   - AI 모델의 overall_score
   - 충치 발견 여부
   - 교합 상태

2. **설문 점수**
   - 예약 시 작성한 설문 응답
   - 건강 상태 관련 질문 답변

3. **종합 점수**
   - 치아 분석 점수와 설문 점수의 가중 평균
   - 분석 횟수, 최근성 등 고려

### 추후 추가될 계산 로직
```javascript
// 예시: 추후 구현될 계산 함수
function calculateOverallScore(userId) {
  // 1. 최근 분석 결과 가져오기
  const analysisScores = getRecentAnalysisScores(userId);
  
  // 2. 설문 점수 계산
  const surveyScore = calculateSurveyScore(userId);
  
  // 3. 가중 평균 계산
  const overallScore = (analysisScores * 0.7) + (surveyScore * 0.3);
  
  return overallScore;
}
```

---

## API 엔드포인트

### 1. 사용자 종합 점수 조회

**GET** `/api/scores/user/:userId`

사용자의 현재 종합 점수를 조회합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

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
    "overall_score": 85.5,
    "analysis_score": 88.0,
    "survey_score": 80.0,
    "image_count": 5,
    "survey_count": 3,
    "last_analysis_date": "2025-11-11",
    "last_calculated_at": "2025-11-11T10:30:00.000Z",
    "updated_at": "2025-11-11T10:30:00.000Z"
  }
}
```

**신규 사용자 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "user_name": "김철수",
    "overall_score": 0,
    "analysis_score": 0,
    "survey_score": 0,
    "image_count": 0,
    "survey_count": 0,
    "last_analysis_date": null,
    "last_calculated_at": "2025-11-11T10:30:00.000Z",
    "is_new": true
  }
}
```

---

### 2. 종합 점수 계산/업데이트

**POST** `/api/scores/calculate/:userId`

사용자의 종합 점수를 계산하고 업데이트합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

**요청 본문**:
```json
{
  "overall_score": 85.5,
  "analysis_score": 88.0,
  "survey_score": 80.0,
  "calculation_details": {
    "method": "weighted_average",
    "weights": {
      "analysis": 0.7,
      "survey": 0.3
    }
  }
}
```

**필드 설명**:
- `overall_score`: 종합 점수 (필수)
- `analysis_score`: 치아 분석 점수 (선택)
- `survey_score`: 설문 점수 (선택)
- `calculation_details`: 계산 상세 정보 (선택)

**요청 예시**:
```bash
curl -X POST http://localhost:3000/api/scores/calculate/1 \
  -H "Content-Type: application/json" \
  -d '{
    "overall_score": 85.5,
    "analysis_score": 88.0,
    "survey_score": 80.0
  }'
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "종합 점수가 업데이트되었습니다.",
  "data": {
    "id": 1,
    "user_id": 1,
    "overall_score": 85.5,
    "analysis_score": 88.0,
    "survey_score": 80.0,
    "image_count": 5,
    "survey_count": 3,
    "last_analysis_date": "2025-11-11",
    "last_calculated_at": "2025-11-11T10:35:00.000Z",
    "updated_at": "2025-11-11T10:35:00.000Z"
  }
}
```

---

### 3. 점수 이력 조회

**GET** `/api/scores/user/:userId/history`

사용자의 점수 변화 이력을 조회합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| limit | number | ❌ | 조회할 개수 | 10 |
| offset | number | ❌ | 건너뛸 개수 | 0 |

**요청 예시**:
```bash
# 최근 10개
curl http://localhost:3000/api/scores/user/1/history

# 최근 20개, 10개 건너뛰기
curl http://localhost:3000/api/scores/user/1/history?limit=20&offset=10
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "total": 15,
    "limit": 10,
    "offset": 0,
    "history": [
      {
        "id": 15,
        "overall_score": 85.5,
        "analysis_score": 88.0,
        "survey_score": 80.0,
        "score_type": "auto",
        "calculation_details": {
          "image_count": 5,
          "survey_count": 3,
          "calculated_at": "2025-11-11T10:35:00.000Z"
        },
        "calculated_at": "2025-11-11T10:35:00.000Z"
      },
      {
        "id": 14,
        "overall_score": 83.0,
        "analysis_score": 85.0,
        "survey_score": 78.0,
        "score_type": "auto",
        "calculation_details": {},
        "calculated_at": "2025-11-10T15:20:00.000Z"
      }
    ]
  }
}
```

---

### 4. 점수 통계 조회 (대시보드)

**GET** `/api/scores/user/:userId/statistics`

사용자의 상세 통계 정보를 조회합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

**요청 예시**:
```bash
curl http://localhost:3000/api/scores/user/1/statistics
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "user_name": "김철수",
    "current_score": {
      "overall_score": 85.5,
      "analysis_score": 88.0,
      "survey_score": 80.0,
      "image_count": 5,
      "survey_count": 3,
      "last_analysis_date": "2025-11-11",
      "last_calculated_at": "2025-11-11T10:35:00.000Z"
    },
    "statistics": {
      "total_images": 5,
      "avg_analysis_score": 86.5,
      "score_trend": [
        {
          "overall_score": 80.0,
          "calculated_at": "2025-10-15T10:00:00.000Z"
        },
        {
          "overall_score": 83.0,
          "calculated_at": "2025-10-25T14:30:00.000Z"
        },
        {
          "overall_score": 85.5,
          "calculated_at": "2025-11-11T10:35:00.000Z"
        }
      ],
      "recent_analysis": [
        {
          "id": 5,
          "cloudinary_url": "https://res.cloudinary.com/.../image5.jpg",
          "uploaded_at": "2025-11-11T09:00:00.000Z",
          "overall_score": 9.0,
          "cavity_detected": false
        }
      ]
    }
  }
}
```

---

### 5. 리더보드 조회

**GET** `/api/scores/leaderboard`

전체 사용자의 점수 순위를 조회합니다.

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 | 기본값 |
|---------|------|------|------|--------|
| limit | number | ❌ | 조회할 사용자 수 | 10 |

**요청 예시**:
```bash
# 상위 10명
curl http://localhost:3000/api/scores/leaderboard

# 상위 20명
curl http://localhost:3000/api/scores/leaderboard?limit=20
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "user_id": 3,
      "user_name": "박지성",
      "overall_score": 92.5,
      "image_count": 8,
      "survey_count": 5,
      "last_calculated_at": "2025-11-11T12:00:00.000Z"
    },
    {
      "user_id": 1,
      "user_name": "김철수",
      "overall_score": 85.5,
      "image_count": 5,
      "survey_count": 3,
      "last_calculated_at": "2025-11-11T10:35:00.000Z"
    },
    {
      "user_id": 2,
      "user_name": "이영희",
      "overall_score": 78.0,
      "image_count": 4,
      "survey_count": 2,
      "last_calculated_at": "2025-11-10T16:20:00.000Z"
    }
  ]
}
```

---

## 데이터베이스 구조

### user_health_scores 테이블

```sql
CREATE TABLE user_health_scores (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  overall_score DECIMAL(4, 1) DEFAULT 0,     -- 종합 점수 (0-100)
  analysis_score DECIMAL(4, 1) DEFAULT 0,    -- 치아 분석 점수 (0-100)
  survey_score DECIMAL(4, 1) DEFAULT 0,      -- 설문 점수 (0-100)
  image_count INT DEFAULT 0,                  -- 분석된 이미지 수
  survey_count INT DEFAULT 0,                 -- 완료된 설문 수
  last_analysis_date DATE,                    -- 마지막 분석 날짜
  last_calculated_at TIMESTAMP,              -- 마지막 계산 시간
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE KEY unique_user (user_id)
);
```

### score_history 테이블

```sql
CREATE TABLE score_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  overall_score DECIMAL(4, 1) NOT NULL,      -- 종합 점수
  analysis_score DECIMAL(4, 1),              -- 치아 분석 점수
  survey_score DECIMAL(4, 1),                -- 설문 점수
  score_type ENUM('manual', 'auto', 'initial'), -- 계산 유형
  calculation_details JSON,                   -- 계산 상세 정보
  calculated_at TIMESTAMP
);
```

---

## 사용 시나리오

### 시나리오 1: 신규 사용자

1. 사용자 회원가입
2. 점수 조회 → 자동으로 초기 점수(0) 생성
3. 첫 번째 사진 분석 완료
4. 점수 계산 API 호출 → 점수 업데이트

### 시나리오 2: 기존 사용자

1. 새로운 사진 업로드 및 분석
2. 백그라운드에서 자동 점수 계산
3. 점수 업데이트 및 이력 저장
4. 대시보드에서 점수 추이 확인

### 시나리오 3: 점수 계산 로직 추가 (추후)

```javascript
// routes/scores.js에 추가할 함수
async function autoCalculateScore(userId) {
  // 1. 최근 분석 결과 조회
  const recentAnalysis = await getRecentAnalysis(userId);
  
  // 2. 설문 응답 조회
  const surveyResults = await getSurveyResults(userId);
  
  // 3. 점수 계산
  const analysisScore = calculateAnalysisScore(recentAnalysis);
  const surveyScore = calculateSurveyScore(surveyResults);
  const overallScore = (analysisScore * 0.7) + (surveyScore * 0.3);
  
  // 4. 점수 업데이트
  await updateScore(userId, {
    overall_score: overallScore,
    analysis_score: analysisScore,
    survey_score: surveyScore
  });
}
```

---

## 점수 타입

| 타입 | 설명 |
|------|------|
| manual | 관리자가 수동으로 입력한 점수 |
| auto | 시스템이 자동으로 계산한 점수 |
| initial | 초기 설정 점수 (0점) |

---

## 통합 예시

### 사진 분석 후 자동 점수 업데이트

```javascript
// routes/images.js의 processAIAnalysis 함수에 추가

// AI 분석 완료 후
await updateAnalysisResult(imageId, analysisData);

// 자동으로 사용자 점수 재계산
if (userId) {
  await axios.post(`http://localhost:3000/api/scores/calculate/${userId}`, {
    overall_score: calculatedScore,
    analysis_score: analysisScore,
    survey_score: 0  // 설문 점수는 별도 계산
  });
}
```

---

## 에러 응답

| HTTP 상태 | 설명 |
|-----------|------|
| 200 | 성공 |
| 404 | 사용자를 찾을 수 없음 |
| 500 | 서버 내부 오류 |

---

## 테스트 예시

```bash
# 1. 사용자 점수 조회
curl http://localhost:3000/api/scores/user/1

# 2. 점수 업데이트
curl -X POST http://localhost:3000/api/scores/calculate/1 \
  -H "Content-Type: application/json" \
  -d '{"overall_score": 85.5, "analysis_score": 88.0, "survey_score": 80.0}'

# 3. 점수 이력 조회
curl http://localhost:3000/api/scores/user/1/history

# 4. 통계 조회
curl http://localhost:3000/api/scores/user/1/statistics

# 5. 리더보드 조회
curl http://localhost:3000/api/scores/leaderboard?limit=10
```

