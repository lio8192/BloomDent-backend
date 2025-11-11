#!/bin/bash

# BloomDent 데이터베이스 설정 스크립트

echo "🦷 BloomDent 데이터베이스 설정을 시작합니다..."
echo ""

# .env 파일 확인
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다."
  echo "📝 .env.example 파일을 복사하여 .env 파일을 생성하고 데이터베이스 정보를 입력해주세요."
  exit 1
fi

# .env 파일에서 변수 로드
export $(cat .env | grep -v '^#' | xargs)

echo "📊 데이터베이스 정보:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# MariaDB 접속 명령어 구성
MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"

if [ -n "$DB_PASSWORD" ]; then
  MYSQL_CMD="$MYSQL_CMD -p$DB_PASSWORD"
fi

echo "🔧 스키마 생성 중..."
$MYSQL_CMD $DB_NAME < database/schema.sql

if [ $? -eq 0 ]; then
  echo "✅ 스키마 생성 완료"
else
  echo "❌ 스키마 생성 실패"
  exit 1
fi

echo ""
echo "📝 샘플 데이터 삽입 중..."
$MYSQL_CMD $DB_NAME < database/seed_data.sql

if [ $? -eq 0 ]; then
  echo "✅ 샘플 데이터 삽입 완료"
else
  echo "❌ 샘플 데이터 삽입 실패"
  exit 1
fi

echo ""
echo "🎉 데이터베이스 설정이 완료되었습니다!"
echo ""
echo "다음 명령어로 서버를 시작하세요:"
echo "  npm run dev"

