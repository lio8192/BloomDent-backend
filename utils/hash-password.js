// 비밀번호 해싱 유틸리티
// 사용법: node utils/hash-password.js [비밀번호]

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'password123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('해싱 오류:', err);
    return;
  }
  
  console.log('비밀번호:', password);
  console.log('해시:', hash);
  console.log('\n이 해시를 데이터베이스에 저장하세요.');
});

