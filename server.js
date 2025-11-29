require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(cors()); // CORS 허용
app.use(morgan('dev')); // 로깅
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 파싱

// 라우트 설정
const apiRoutes = require('./routes/api');
const clinicsRoutes = require('./routes/clinics');
const appointmentsRoutes = require('./routes/appointments');
const usersRoutes = require('./routes/users');
const imagesRoutes = require('./routes/images');
const surveyRoutes = require('./routes/survey');
const scoresRoutes = require('./routes/scores');
const surveyDetailRoutes = require('./routes/survey_detail');


app.use('/api', apiRoutes);
app.use('/api/clinics', clinicsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/survey-detail', surveyDetailRoutes);

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    message: 'BloomDent API Server',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 에러 핸들링
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '요청하신 API를 찾을 수 없습니다.'
  });
});

// 전역 에러 핸들링
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '서버 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 서버 시작
const startServer = async () => {
  // DB 연결 테스트
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행중입니다.`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 기본 API: http://localhost:${PORT}/api/hello`);
    console.log(`📍 주변 치과: http://localhost:${PORT}/api/clinics/nearby?latitude=37.5012767&longitude=127.0396597`);
    console.log(`📍 설문 질문: http://localhost:${PORT}/api/appointments/surveys/questions`);
  });
};

startServer();

