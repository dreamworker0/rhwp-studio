export function renderSupport(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: 'Inter', 'Pretendard', sans-serif; line-height: 1.6; color: #e2e8f0;">
      <h1 style="color: #f8fafc; margin-bottom: 8px;">고객 지원 (Support)</h1>
      <p style="color: #94a3b8; margin-bottom: 32px;">rhwp Studio 앱을 이용해 주셔서 감사합니다.</p>

      <p style="color: #e2e8f0;">앱 사용 중 발생하는 오류, 설치 관련 문의 및 기타 질문 사항이 있으시다면 아래의 연락처로 문의해 주시기 바랍니다. 확인 후 최대한 빠르게 답변해 드리겠습니다.</p>
      
      <div style="background-color: #1e293b; padding: 20px; border-radius: 6px; border-left: 4px solid #818cf8; margin-top: 30px;">
        <p style="margin-bottom: 5px; font-weight: bold; color: #94a3b8;">고객 지원 이메일 (Contact Email)</p>
        <a href="mailto:ehsheh@gmail.com" style="font-size: 18px; font-weight: bold; color: #818cf8; text-decoration: none;">ehsheh@gmail.com</a>
      </div>

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #334155; text-align: center;">
        <a href="/" style="color: #818cf8; text-decoration: none;">&larr; 홈으로 돌아가기 (Back to Home)</a>
      </div>
    </div>
  `;
}
