const mysql = require('mysql2');

// MariaDB 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Promise 기반 쿼리 사용을 위한 설정
const promisePool = pool.promise();

// 데이터베이스 연결 테스트
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ MariaDB 연결 성공!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MariaDB 연결 실패:', error.message);
    return false;
  }
};

module.exports = {
  pool: promisePool,
  testConnection
};

