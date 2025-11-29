// services/oralTipsService.js
const { ai } = require('../utils/geminiClient');

/**
 * 오늘의 구강 관리 Tip을 생성하는 서비스 함수
 * - 역할: 제미나이에게 프롬프트를 보내고, 한 줄~몇 줄 정도의 팁 텍스트를 받아온다.
 */
async function generateOralCareTip() {
  const prompt = `
당신은 사용자에게 일상적인 구강 건강을 도와주는 치과 위생사입니다.
다음 조건을 지켜 "오늘의 구강 관리 팁"을 하나만 만들어 주세요.

- 한국어로, 반말은 절대 쓰지 말고 존댓말로 작성하세요.
- 2~3문장 정도의 짧은 팁으로 작성하세요.
- 너무 일반적인 "양치 잘 하세요" 한 줄이 아니라,
  오늘 바로 실천할 수 있는 구체적인 행동 하나를 알려 주세요.
- 사용자의 나이대는 20~30대라고 가정하세요.
- "오늘의 Tip:" 같은 제목은 쓰지 말고, 바로 내용만 작성하세요.
- 하루마다 조금씩 다른 내용이 나올 수 있도록, 매번 다양한 주제를 섞어 주세요.
`;

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash', // 빠르고 저렴한 모델 (추후 필요시 pro 계열로 변경 가능)
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const text = (result.text || '').trim();

  if (!text) {
    // 비어 있으면 기본 문구라도 리턴
    return '오늘은 취침 전에 치실이나 치간칫솔을 사용해서, 치아 사이에 낀 음식물을 한 번만이라도 꼭 제거해 보세요.';
  }

  return text;
}

module.exports = { generateOralCareTip };