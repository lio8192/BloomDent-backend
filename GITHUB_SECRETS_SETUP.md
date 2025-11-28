# GitHub Secrets 설정 가이드

GitHub Actions에서 사용할 환경 변수들을 GitHub Secrets에 등록하는 방법입니다.

## 📋 설정할 Secrets 목록

다음 환경 변수들을 GitHub Repository Secrets에 등록해야 합니다.

### 1. Server Configuration

| Secret 이름 | 설명 | 예시 값 |
|-------------|------|--------|
| `PORT` | 서버 포트 번호 | `3000` |
| `NODE_ENV` | 실행 환경 | `production` |

### 2. MariaDB Configuration

| Secret 이름 | 설명 | 예시 값 |
|-------------|------|--------|
| `DB_HOST` | 데이터베이스 호스트 | `localhost` 또는 `127.0.0.1` |
| `DB_PORT` | 데이터베이스 포트 | `3306` |
| `DB_USER` | 데이터베이스 사용자명 | `root` |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | `your_password` |
| `DB_NAME` | 데이터베이스 이름 | `bloomdent` |

### 3. AI Server Configuration

| Secret 이름 | 설명 | 예시 값 |
|-------------|------|--------|
| `AI_SERVER_URL` | AI 분석 서버 URL | `http://localhost:5000` |

### 4. Cloudinary Configuration

| Secret 이름 | 설명 | 예시 값 |
|-------------|------|--------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_api_secret` |

---

## 🔧 GitHub Secrets 등록 방법

### 1. GitHub Repository 페이지로 이동

```
https://github.com/your-username/BloomDent-backend
```

### 2. Settings 메뉴 클릭

Repository 상단의 **Settings** 탭을 클릭합니다.

### 3. Secrets and variables 선택

왼쪽 사이드바에서:
1. **Secrets and variables** 클릭
2. **Actions** 클릭

### 4. New repository secret 클릭

오른쪽 상단의 **New repository secret** 버튼을 클릭합니다.

### 5. Secret 추가

각 환경 변수를 하나씩 추가합니다:

**예시: PORT 추가**
```
Name: PORT
Secret: 3000
```

위의 표에 나열된 모든 Secret을 동일한 방법으로 추가합니다.

---

## 📝 한 번에 설정하기 (체크리스트)

아래 체크리스트를 따라 하나씩 등록하세요:

### Server Configuration
- [ ] `PORT` → `3000`
- [ ] `NODE_ENV` → `production`

### MariaDB Configuration
- [ ] `DB_HOST` → `localhost`
- [ ] `DB_PORT` → `3306`
- [ ] `DB_USER` → `root`
- [ ] `DB_PASSWORD` → `YOUR_DB_PASSWORD`
- [ ] `DB_NAME` → `bloomdent`

### AI Server Configuration
- [ ] `AI_SERVER_URL` → `http://localhost:5000`

### Cloudinary Configuration
- [ ] `CLOUDINARY_CLOUD_NAME` → `YOUR_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY` → `YOUR_API_KEY`
- [ ] `CLOUDINARY_API_SECRET` → `YOUR_API_SECRET`

---

## ✅ 설정 확인

### 1. Secrets 목록 확인

Settings → Secrets and variables → Actions에서 다음 항목들이 보여야 합니다:

```
PORT
NODE_ENV
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
AI_SERVER_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

### 2. GitHub Actions 실행

Secrets를 모두 등록한 후:

1. 코드를 `main` 브랜치에 push
2. Actions 탭에서 워크플로우 실행 확인
3. `.env 파일 생성` 단계가 성공하는지 확인

---

## 🔒 보안 주의사항

### ⚠️ 절대로 하지 말아야 할 것

1. ❌ `.env` 파일을 Git에 커밋하지 마세요
2. ❌ Secrets 값을 코드에 하드코딩하지 마세요
3. ❌ 로그에 Secret 값이 출력되지 않도록 주의하세요

### ✅ 권장 사항

1. ✅ `.env`는 `.gitignore`에 포함
2. ✅ 민감한 정보는 모두 GitHub Secrets 사용
3. ✅ 정기적으로 비밀번호와 API 키 갱신

---

## 🐛 문제 해결

### Secret이 적용되지 않을 때

1. **Secret 이름 확인**
   - 대소문자가 정확히 일치하는지 확인
   - 공백이 없는지 확인

2. **Runner 재시작**
   ```bash
   # self-hosted runner 재시작
   cd actions-runner
   ./run.sh
   ```

3. **워크플로우 재실행**
   - Actions 탭에서 실패한 워크플로우를 "Re-run jobs"

### .env 파일이 생성되지 않을 때

GitHub Actions 로그에서 "🔐 .env 파일 생성" 단계를 확인:

```bash
# 로그 예시
Creating .env file with environment variables...
✅ .env 파일이 생성되었습니다.
```

에러가 있다면 Secret이 제대로 등록되었는지 확인하세요.

---

## 📚 관련 문서

- [GitHub Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

---

## 💡 추가 팁

### 로컬 개발 vs 프로덕션

**로컬 개발 환경**:
```bash
# .env 파일 직접 생성
cp .env.example .env
# 값 수정
```

**프로덕션 환경** (GitHub Actions):
```bash
# GitHub Secrets에서 자동으로 .env 생성
# 별도 작업 불필요
```

### Secret 값 테스트

Secrets가 제대로 설정되었는지 테스트하려면:

```yaml
- name: Test Secrets
  run: |
    echo "PORT is set: ${{ secrets.PORT != '' }}"
    echo "DB_HOST is set: ${{ secrets.DB_HOST != '' }}"
```

실제 값은 출력되지 않고 설정 여부만 확인됩니다.

