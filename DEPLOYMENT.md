# 🚀 BloomDent 배포 가이드

## 📋 목차
- [사전 준비](#사전-준비)
- [Self-Hosted Runner 설정](#self-hosted-runner-설정)
- [배포 프로세스](#배포-프로세스)
- [수동 배포](#수동-배포)
- [문제 해결](#문제-해결)

---

## 사전 준비

### 서버 요구사항
- **Node.js**: v16 이상
- **npm**: v8 이상
- **MariaDB**: v10 이상
- **PM2**: 프로세스 관리
- **Git**: 버전 관리

### 필수 설치

```bash
# Node.js 확인
node -v
npm -v

# PM2 설치 (전역)
npm install -g pm2

# PM2 시작 시 자동 실행 설정
pm2 startup
pm2 save
```

---

## Self-Hosted Runner 설정

### 1. GitHub Runner 설치

1. GitHub 저장소 → **Settings** → **Actions** → **Runners**
2. **New self-hosted runner** 클릭
3. 운영체제 선택 (Linux/macOS/Windows)
4. 제공된 명령어 실행

**예시 (Linux/macOS):**
```bash
# 다운로드
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# 설정
./config.sh --url https://github.com/YOUR_USERNAME/BloomDent-backend --token YOUR_TOKEN

# 서비스로 실행 (백그라운드)
sudo ./svc.sh install
sudo ./svc.sh start
```

### 2. Runner 상태 확인

```bash
# Runner 상태 확인
sudo ./svc.sh status

# Runner 로그 확인
./run.sh
```

---

## 배포 프로세스

### 자동 배포 (GitHub Actions)

**main** 브랜치에 push하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main
```

### 배포 과정

1. ✅ 코드 체크아웃
2. ✅ 의존성 설치 (`npm install`)
3. ✅ 환경 변수 확인 (`.env` 파일)
4. ✅ PM2로 애플리케이션 재시작
5. ✅ 배포 완료

### GitHub Actions 확인

1. GitHub 저장소 → **Actions** 탭
2. 최근 워크플로우 실행 확인
3. 로그 확인

---

## 수동 배포

### 방법 1: 배포 스크립트 사용

```bash
# 실행 권한 부여
chmod +x deploy.sh

# 배포 실행
./deploy.sh
```

### 방법 2: PM2 직접 사용

```bash
# 의존성 설치
npm install

# PM2로 시작
pm2 start ecosystem.config.js

# 또는 재시작
pm2 restart bloomdent-api

# 설정 저장
pm2 save
```

### 방법 3: 직접 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

---

## PM2 명령어

### 기본 명령어

```bash
# 프로세스 목록 확인
pm2 list

# 상세 정보
pm2 show bloomdent-api

# 로그 확인
pm2 logs bloomdent-api

# 실시간 로그
pm2 logs bloomdent-api --lines 100

# 재시작
pm2 restart bloomdent-api

# 중지
pm2 stop bloomdent-api

# 삭제
pm2 delete bloomdent-api

# 모니터링
pm2 monit
```

### 고급 명령어

```bash
# 메모리 사용량 확인
pm2 list

# 프로세스 재시작 (0-second downtime)
pm2 reload bloomdent-api

# 설정 파일로 재시작
pm2 restart ecosystem.config.js

# 로그 파일 삭제
pm2 flush
```

---

## 환경 설정

### .env 파일 설정

서버에 `.env` 파일이 있어야 합니다:

```bash
# 서버에서 .env 파일 생성
nano .env
```

```env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bloomdent_db
```

### 데이터베이스 초기 설정

```bash
# 데이터베이스 설정 (최초 1회)
npm run setup-db
```

---

## 로그 관리

### 로그 위치

PM2 로그는 `logs/` 디렉토리에 저장됩니다:
- `logs/out.log` - 표준 출력
- `logs/err.log` - 에러 로그
- `logs/combined.log` - 전체 로그

### 로그 확인

```bash
# 전체 로그
pm2 logs bloomdent-api

# 에러 로그만
pm2 logs bloomdent-api --err

# 출력 로그만
pm2 logs bloomdent-api --out

# 최근 100줄
pm2 logs bloomdent-api --lines 100
```

---

## 문제 해결

### 배포 실패 시

1. **GitHub Actions 로그 확인**
   ```
   GitHub → Actions → 실패한 워크플로우 → 로그 확인
   ```

2. **서버 로그 확인**
   ```bash
   pm2 logs bloomdent-api
   ```

3. **프로세스 상태 확인**
   ```bash
   pm2 status
   ```

### 일반적인 문제

#### 1. .env 파일이 없음
```bash
# .env 파일 생성
cp .env.example .env
nano .env
```

#### 2. 포트가 이미 사용 중
```bash
# 포트 사용 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

#### 3. PM2 프로세스가 응답하지 않음
```bash
# PM2 재시작
pm2 kill
pm2 start ecosystem.config.js
```

#### 4. 데이터베이스 연결 실패
```bash
# MariaDB 상태 확인
sudo systemctl status mariadb

# MariaDB 재시작
sudo systemctl restart mariadb

# .env 파일의 DB 정보 확인
cat .env
```

#### 5. npm install 실패
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
rm package-lock.json
npm install
```

---

## 롤백

문제가 발생한 경우 이전 버전으로 롤백:

```bash
# Git으로 이전 커밋으로 돌아가기
git log  # 커밋 해시 확인
git checkout <commit-hash>

# 의존성 재설치
npm install

# PM2 재시작
pm2 restart bloomdent-api
```

---

## 보안 권장사항

1. ✅ `.env` 파일을 Git에 커밋하지 마세요
2. ✅ 서버 방화벽 설정
3. ✅ HTTPS 사용 (Nginx + Let's Encrypt)
4. ✅ 정기적인 보안 업데이트
5. ✅ 로그 모니터링

---

## 성능 최적화

### PM2 클러스터 모드

`ecosystem.config.js` 수정:
```javascript
module.exports = {
  apps: [{
    name: 'bloomdent-api',
    script: './server.js',
    instances: 'max',  // CPU 코어 수만큼 실행
    exec_mode: 'cluster',
    // ... 나머지 설정
  }]
};
```

---

## 유용한 링크

- [PM2 공식 문서](https://pm2.keymetrics.io/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Node.js 배포 가이드](https://nodejs.org/en/docs/guides/)

