export function renderTerms(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: 'Inter', 'Pretendard', sans-serif; line-height: 1.6; color: #e2e8f0;">
      <h1 style="color: #f8fafc; margin-bottom: 8px;">서비스 약관 (Terms of Service)</h1>
      <p style="color: #94a3b8; margin-bottom: 32px;">최종 수정일 (Last Updated): 2026년 4월 (April 2026)</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">1. 약관 동의</h2>
      <p>rhwp Studio("서비스")에 접속하거나 사용함으로써 귀하는 본 서비스 약관에 동의하게 됩니다. 본 약관에 동의하지 않으실 경우 서비스 이용을 중단해 주시기 바랍니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>1. Acceptance of Terms:</strong> By accessing or using rhwp Studio ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">2. 서비스 안내</h2>
      <p>rhwp Studio는 사용자가 Google Drive에서 HWP/HWPX 파일을 직접 열람하고 편집할 수 있도록 돕는 웹 기반 애플리케이션입니다. 본 서비스는 WebAssembly를 사용하여 문서를 귀하의 브라우저 내부에서만 처리합니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>2. Description of Service:</strong> rhwp Studio is a web-based application that allows users to open, view, and edit HWP/HWPX files directly from their Google Drive. The Service uses WebAssembly to process documents entirely within your browser.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">3. 개인정보 및 데이터 접근</h2>
      <p>본 서비스는 귀하가 명시적으로 선택한 파일을 열고 저장하기 위해 Google Drive 접근 권한을 요구합니다. 당사는 귀하의 파일을 외부 서버에 저장하지 않으며 모든 처리는 로컬 환경에서 이루어집니다. 자세한 내용은 <a href="/privacy" style="color: #818cf8; text-decoration: none;">개인정보처리방침</a>을 확인해 주십시오.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>3. Privacy and Data Access:</strong> The Service requires access to your Google Drive to open and save files you explicitly select. We do not store your files on any external servers. All processing is done locally in your browser. For more details, please review our Privacy Policy.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">4. 사용자의 책임</h2>
      <p>본 서비스를 사용하여 편집하는 파일의 내용에 대한 책임은 전적으로 귀하에게 있습니다. 귀하는 불법적이거나 금지된 활동에 본 서비스를 사용하지 않을 것에 동의합니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>4. User Responsibilities:</strong> You are solely responsible for the content of the files you edit using the Service. You agree not to use the Service for any unlawful or prohibited activities.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">5. 보증의 부인 및 면책</h2>
      <p>본 서비스는 "있는 그대로", "사용 가능한 상태"로 제공되며 명시적이든 묵시적이든 어떠한 보증도 하지 않습니다. 본 서비스의 사용으로 인해 발생하는 데이터 손실이나 기타 피해에 대해 개발자는 책임지지 않습니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>5. Disclaimer and Limitation of Liability:</strong> The Service is provided "AS IS" without warranties of any kind. In no event shall the developers be liable for any damages or loss of data arising from your use of the Service.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">6. 문의 (Contact Us)</h2>
      <p>본 약관에 대해 궁금한 점이 있으시면 다음 이메일로 문의해 주시기 바랍니다: ehsheh@gmail.com</p>

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #334155; text-align: center;">
        <a href="/" style="color: #818cf8; text-decoration: none;">&larr; 홈으로 돌아가기 (Back to Home)</a>
      </div>
    </div>
  `;
}
