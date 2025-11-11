#!/bin/bash

# BloomDent 백엔드 배포 스크립트

echo "🚀 BloomDent API 배포를 시작합니다..."
echo ""

# 환경 변수 파일 확인
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다!"
  echo "💡 .env 파일을 생성하고 데이터베이스 정보를 입력해주세요."
  exit 1
fi

echo "📦 의존성 설치 중..."
npm install

if [ $? -ne 0 ]; then
  echo "❌ npm install 실패"
  exit 1
fi

echo "✅ 의존성 설치 완료"
echo ""

# PM2 설치 확인
if ! command -v pm2 &> /dev/null; then
  echo "⚠️  PM2가 설치되어 있지 않습니다."
  echo "📦 PM2 설치 중..."
  npm install -g pm2
fi

echo "🔄 애플리케이션 배포 중..."

# PM2로 애플리케이션 시작/재시작
if pm2 list | grep -q "bloomdent-api"; then
  echo "🔄 기존 프로세스 재시작 중..."
  pm2 restart ecosystem.config.js
else
  echo "🚀 새로운 프로세스 시작 중..."
  pm2 start ecosystem.config.js
fi

# PM2 설정 저장
pm2 save

echo ""
echo "✅ 배포 완료!"
echo ""
echo "📊 현재 실행 중인 프로세스:"
pm2 list

echo ""
echo "💡 유용한 명령어:"
echo "  - 로그 확인: pm2 logs bloomdent-api"
echo "  - 상태 확인: pm2 status"
echo "  - 재시작: pm2 restart bloomdent-api"
echo "  - 중지: pm2 stop bloomdent-api"
echo "  - 모니터링: pm2 monit"

