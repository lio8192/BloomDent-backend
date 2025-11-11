# 🖼️ 치아 사진 분석 API 문서

## 📋 목차
- [개요](#개요)
- [시스템 구조](#시스템-구조)
- [API 엔드포인트](#api-엔드포인트)
- [Flask AI 서버 연동](#flask-ai-서버-연동)

---

## 개요

치아 사진을 업로드하고 AI 모델을 통해 분석하는 API입니다.

### 주요 기능
- ✅ 사진 업로드 (Cloudinary)
- ✅ AI 모델 분석 (Flask 서버 연동)
- ✅ 교합, 충치, 잇몸 상태 분석
- ✅ 비동기 처리 (백그라운드 분석)
- ✅ 분석 상태 추적

---

## 시스템 구조

```
[클라이언트]
    ↓ 1. 사진 업로드
[Node.js API]
    ↓ 2. Cloudinary 업로드
[Cloudinary]
    ↓ 3. DB 저장 (pending)
[MariaDB]
    ↓ 4. 비동기 AI 분석 요청
[Flask AI 서버]
    ↓ 5. 분석 결과 저장
[MariaDB]
```

---

## API 엔드포인트

### 1. 사진 업로드 및 분석 요청

**POST** `/api/images/upload`

사진을 업로드하고 AI 분석을 요청합니다.

**요청 형식**: `multipart/form-data`

**폼 데이터**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| image | file | ✅ | 이미지 파일 (jpeg, jpg, png, gif, webp) |
| user_id | number | ❌ | 사용자 ID |
| image_type | string | ❌ | 사진 유형 (front/side/upper/lower/other) |

**요청 예시** (cURL):
```bash
curl -X POST http://localhost:3000/api/images/upload \
  -F "image=@/path/to/dental-photo.jpg" \
  -F "user_id=1" \
  -F "image_type=front"
```

**요청 예시** (JavaScript):
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('user_id', 1);
formData.append('image_type', 'front');

const response = await fetch('http://localhost:3000/api/images/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

**성공 응답 (201)**:
```json
{
  "success": true,
  "message": "이미지 업로드 완료. 분석이 진행 중입니다.",
  "data": {
    "image_id": 1,
    "cloudinary_url": "https://res.cloudinary.com/.../image.jpg",
    "analysis_status": "processing"
  }
}
```

**실패 응답 (400)**:
```json
{
  "success": false,
  "message": "이미지 파일이 필요합니다."
}
```

---

### 2. 분석 상태 조회

**GET** `/api/images/:id/status`

이미지의 분석 상태를 확인합니다.

**경로 파라미터**:
- `id`: 이미지 ID

**요청 예시**:
```bash
curl http://localhost:3000/api/images/1/status
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "cloudinary_url": "https://res.cloudinary.com/.../image.jpg",
    "image_type": "front",
    "analysis_status": "completed",
    "uploaded_at": "2025-11-11T10:30:00.000Z"
  }
}
```

**분석 상태 값**:
- `pending`: 분석 대기 중
- `processing`: 분석 진행 중
- `completed`: 분석 완료
- `failed`: 분석 실패

---

### 3. 분석 결과 조회

**GET** `/api/images/:id/analysis`

이미지의 상세 분석 결과를 조회합니다.

**경로 파라미터**:
- `id`: 이미지 ID

**요청 예시**:
```bash
curl http://localhost:3000/api/images/1/analysis
```

**성공 응답 - 분석 완료 (200)**:
```json
{
  "success": true,
  "data": {
    "image_id": 1,
    "cloudinary_url": "https://res.cloudinary.com/.../image.jpg",
    "image_type": "front",
    "uploaded_at": "2025-11-11T10:30:00.000Z",
    "analysis": {
      "occlusion": {
        "status": "정상",
        "comment": "교합 상태가 양호합니다. 상하악의 맞물림이 적절합니다."
      },
      "cavity": {
        "detected": true,
        "locations": ["우측 상악 제1대구치", "좌측 하악 제2소구치"],
        "comment": "2개의 충치가 발견되었습니다. 조기 치료가 권장됩니다."
      },
      "overall_score": 7.5,
      "recommendations": "1. 충치 치료 예약\n2. 정기 검진\n3. 올바른 칫솔질 교육",
      "ai_confidence": 92.5,
      "analyzed_at": "2025-11-11T10:31:30.000Z"
    }
  }
}
```

**성공 응답 - 분석 중 (200)**:
```json
{
  "success": true,
  "data": {
    "image_id": 1,
    "cloudinary_url": "https://res.cloudinary.com/.../image.jpg",
    "analysis_status": "processing",
    "message": "분석이 진행 중입니다."
  }
}
```

---

### 4. 사용자 이미지 목록 조회

**GET** `/api/images/user/:userId`

특정 사용자의 모든 이미지를 조회합니다.

**경로 파라미터**:
- `userId`: 사용자 ID

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| status | string | ❌ | 상태 필터 (pending/processing/completed/failed) |

**요청 예시**:
```bash
# 전체 목록
curl http://localhost:3000/api/images/user/1

# 완료된 항목만
curl http://localhost:3000/api/images/user/1?status=completed
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 3,
      "cloudinary_url": "https://res.cloudinary.com/.../image3.jpg",
      "image_type": "front",
      "analysis_status": "completed",
      "uploaded_at": "2025-11-11T12:00:00.000Z",
      "overall_score": 8.2,
      "analyzed_at": "2025-11-11T12:01:30.000Z"
    },
    {
      "id": 2,
      "cloudinary_url": "https://res.cloudinary.com/.../image2.jpg",
      "image_type": "side",
      "analysis_status": "processing",
      "uploaded_at": "2025-11-11T11:30:00.000Z",
      "overall_score": null,
      "analyzed_at": null
    }
  ]
}
```

---

### 5. 이미지 삭제

**DELETE** `/api/images/:id`

이미지와 분석 결과를 삭제합니다.

**경로 파라미터**:
- `id`: 이미지 ID

**요청 예시**:
```bash
curl -X DELETE http://localhost:3000/api/images/1
```

**성공 응답 (200)**:
```json
{
  "success": true,
  "message": "이미지가 삭제되었습니다."
}
```

---

## Flask AI 서버 연동

### Flask 서버 API 명세

Node.js 서버가 Flask AI 서버로 요청을 보낼 때 사용하는 API 형식입니다.

**엔드포인트**: `POST /api/analyze`

**요청 본문**:
```json
{
  "image_url": "https://res.cloudinary.com/.../image.jpg",
  "image_id": 1
}
```

**Flask 서버 응답 형식**:
```json
{
  "occlusion_status": "정상",
  "occlusion_comment": "교합 상태가 양호합니다.",
  "cavity_detected": true,
  "cavity_locations": ["우측 상악 제1대구치", "좌측 하악 제2소구치"],
  "cavity_comment": "2개의 충치가 발견되었습니다.",
  "overall_score": 7.5,
  "recommendations": "1. 충치 치료 예약\n2. 정기 검진",
  "ai_confidence": 92.5
}
```

### Flask 서버 예시 코드

```python
from flask import Flask, request, jsonify
import numpy as np
# AI 모델 import

app = Flask(__name__)

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    data = request.json
    image_url = data.get('image_url')
    image_id = data.get('image_id')
    
    # 이미지 다운로드 및 전처리
    # image = download_and_preprocess(image_url)
    
    # AI 모델로 분석
    # result = model.predict(image)
    
    # 결과 반환
    return jsonify({
        'occlusion_status': '정상',
        'occlusion_comment': '교합 상태가 양호합니다.',
        'cavity_detected': True,
        'cavity_locations': ['우측 상악 제1대구치'],
        'cavity_comment': '충치가 발견되었습니다.',
        'overall_score': 8.5,
        'recommendations': '정기 검진을 권장합니다.',
        'ai_confidence': 95.2
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

## 환경 변수 설정

`.env` 파일에 다음 내용을 추가하세요:

```env
# Cloudinary 설정
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI 서버 URL
AI_SERVER_URL=http://localhost:5000
```

### Cloudinary 설정 방법

1. [Cloudinary](https://cloudinary.com/) 가입
2. Dashboard에서 Cloud Name, API Key, API Secret 확인
3. `.env` 파일에 입력

---

## 데이터베이스 구조

### dental_images 테이블
```sql
- id: 이미지 고유 ID
- user_id: 사용자 ID
- cloudinary_id: Cloudinary 고유 ID
- cloudinary_url: 이미지 URL
- original_filename: 원본 파일명
- image_type: 사진 유형
- analysis_status: 분석 상태
- uploaded_at: 업로드 시간
```

### image_analysis 테이블
```sql
- id: 분석 결과 ID
- image_id: 이미지 ID (FK)
- occlusion_status: 교합 상태
- occlusion_comment: 교합 코멘트
- cavity_detected: 충치 발견 여부
- cavity_locations: 충치 위치 (JSON)
- cavity_comment: 충치 코멘트
- overall_score: 종합 점수
- recommendations: 추천 사항
- ai_confidence: AI 신뢰도
- raw_response: 원본 응답 (JSON)
- analyzed_at: 분석 시간
```

---

## 처리 흐름

1. **업로드 단계**
   - 클라이언트가 사진 업로드
   - Multer가 메모리에 파일 저장
   - 임시 파일로 저장

2. **Cloudinary 업로드**
   - Cloudinary에 이미지 업로드
   - URL 및 고유 ID 받기

3. **DB 저장**
   - `dental_images` 테이블에 저장
   - 상태: `pending`

4. **비동기 분석**
   - 상태를 `processing`으로 변경
   - Flask AI 서버로 요청 전송
   - 즉시 클라이언트에 응답 반환

5. **백그라운드 처리**
   - AI 분석 완료 대기
   - 결과를 `image_analysis` 테이블에 저장
   - 상태를 `completed`로 변경

6. **결과 조회**
   - 클라이언트가 상태/결과 조회
   - 완료된 경우 전체 분석 결과 반환

---

## 에러 처리

| HTTP 상태 | 설명 |
|-----------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 (파일 없음, 잘못된 형식) |
| 404 | 이미지를 찾을 수 없음 |
| 500 | 서버 오류 |

---

## 제한 사항

- **파일 크기**: 최대 10MB
- **파일 형식**: jpeg, jpg, png, gif, webp
- **AI 분석 타임아웃**: 60초

---

## 테스트 예시

### Postman으로 테스트

1. **새 요청 생성**: POST `http://localhost:3000/api/images/upload`
2. **Body 탭**: `form-data` 선택
3. **필드 추가**:
   - Key: `image`, Type: `File`, Value: 사진 파일 선택
   - Key: `user_id`, Type: `Text`, Value: `1`
   - Key: `image_type`, Type: `Text`, Value: `front`
4. **Send** 클릭

### JavaScript로 테스트

```javascript
// 파일 선택 input
const fileInput = document.querySelector('input[type="file"]');

// 업로드 함수
async function uploadImage() {
  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('user_id', 1);
  formData.append('image_type', 'front');
  
  try {
    const response = await fetch('http://localhost:3000/api/images/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    console.log('업로드 성공:', data);
    
    // 분석 결과 폴링
    pollAnalysisResult(data.data.image_id);
  } catch (error) {
    console.error('업로드 실패:', error);
  }
}

// 분석 결과 폴링
async function pollAnalysisResult(imageId) {
  const maxAttempts = 30; // 최대 30번 시도
  let attempts = 0;
  
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/images/${imageId}/analysis`);
      const data = await response.json();
      
      if (data.data.analysis_status === 'completed') {
        console.log('분석 완료:', data);
        clearInterval(interval);
      } else if (data.data.analysis_status === 'failed') {
        console.error('분석 실패');
        clearInterval(interval);
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        console.error('타임아웃');
        clearInterval(interval);
      }
    } catch (error) {
      console.error('조회 오류:', error);
      clearInterval(interval);
    }
  }, 2000); // 2초마다 확인
}
```

