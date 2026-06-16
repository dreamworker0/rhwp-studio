export function renderPrivacy(container: HTMLElement) {
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: 'Inter', 'Pretendard', sans-serif; line-height: 1.6; color: #e2e8f0;">
      <h1 style="color: #f8fafc; margin-bottom: 8px;">개인정보처리방침 (Privacy Policy)</h1>
      <p style="color: #94a3b8; margin-bottom: 32px;">최종 수정일 (Last Updated): 2026년 4월 (April 2026)</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">1. 소개 (Introduction)</h2>
      <p>귀하의 개인정보는 당사에게 중요합니다. 본 개인정보처리방침은 귀하가 rhwp Studio의 Google Drive HWP 편집기 서비스를 사용할 때 귀하의 정보를 어떻게 수집하고 보호하는지 설명합니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>1. Introduction:</strong> Your privacy is important to us. This Privacy Policy explains how rhwp Studio collects, uses, and protects your information when you use our service.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">2. 수집하는 정보 (Information We Collect)</h2>
      <p>당사는 데이터 최소화 원칙을 지킵니다. rhwp Studio 사용 시, 당사는 귀하의 개인 데이터를 외부 서버에 <strong>수집, 저장, 또는 처리하지 않습니다.</strong> 본 애플리케이션은 귀하가 열거나 저장하고자 하는 파일에 접근하기 위한 목적으로만 표준 OAuth 권한을 요청합니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>2. Information We Collect:</strong> We believe in data minimization. When you use rhwp Studio, we <strong>do not</strong> collect, store, or process your personal data on our servers. We request standard OAuth permissions solely to access files you choose to edit.</p>
      
      <h2 style="color: #f8fafc; margin-top: 32px;">3. 정보의 사용 방법 (How We Use Your Information)</h2>
      <p>귀하의 Google 계정에서 허용된 권한은 오로지 클라이언트 측(귀하의 웹 브라우저 내부)에서만 다음 목적으로 사용됩니다:</p>
      <ul style="margin-top: 4px; margin-bottom: 4px;">
        <li>선택한 HWP/HWPX 파일의 목록 조회 및 다운로드</li>
        <li>편집된 파일을 다시 귀하의 Google Drive로 업로드</li>
      </ul>
      <p>모든 파일 처리는 WebAssembly를 사용하여 로컬에서 이루어집니다. 귀하의 문서는 절대로 브라우저를 벗어나거나 제3자 서버를 거치지 않습니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>3. How We Use Your Information:</strong> Granted permissions are used exclusively client-side to list, download, and upload your selected files to your Google Drive. All processing is local via WebAssembly.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">4. 데이터 공유 및 공개 (Data Sharing and Disclosure)</h2>
      <p>당사는 귀하의 개인정보나 문서를 제3자에게 판매, 거래, 임대 또는 공유하지 않습니다. 당사 서버에 저장되는 데이터가 없으므로 공유할 데이터 또한 존재하지 않습니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>4. Data Sharing:</strong> We do not sell, trade, rent, or otherwise share your personal information or your documents with any third parties.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">5. 데이터 보안 (Data Security)</h2>
      <p>모든 문서 렌더링 및 편집이 귀하의 로컬 기기에서만 완전히 이루어지도록 보장하여 보안을 최우선으로 합니다. 인증은 Google의 공식 OAuth 2.0 인프라를 통해 안전하게 처리됩니다.</p>
      <p style="color: #94a3b8; font-size: 0.9em; margin-top: 4px;"><strong>5. Data Security:</strong> We prioritize your security by ensuring that all rendering happens locally. Authentication is handled securely through Google's official OAuth 2.0 infrastructure.</p>

      <h2 style="color: #f8fafc; margin-top: 32px;">6. 문의 (Contact Us)</h2>
      <p>본 개인정보처리방침에 대해 궁금한 점이 있으시면 다음 이메일로 문의해 주시기 바랍니다: ehsheh@gmail.com</p>

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #334155; text-align: center;">
        <a href="/" style="color: #818cf8; text-decoration: none;">&larr; 홈으로 돌아가기 (Back to Home)</a>
      </div>
    </div>
  `;
}
