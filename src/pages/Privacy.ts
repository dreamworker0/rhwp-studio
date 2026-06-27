import { renderLegalPage } from '../components/ui'

export function renderPrivacy(container: HTMLElement) {
  container.innerHTML = renderLegalPage(
    '개인정보처리방침 (Privacy Policy)',
    '최종 수정일 (Last Updated): 2026년 6월 (June 2026)',
    `
      <h2>1. 소개 (Introduction)</h2>
      <p>귀하의 개인정보는 당사에게 중요합니다. 본 개인정보처리방침은 귀하가 rhwp Studio의 Google Drive HWP 편집기 서비스를 사용할 때 귀하의 정보를 어떻게 수집하고 보호하는지 설명합니다.</p>
      <p class="en"><strong>1. Introduction:</strong> Your privacy is important to us. This Privacy Policy explains how rhwp Studio collects, uses, and protects your information when you use our service.</p>

      <h2>2. 수집하는 정보 (Information We Collect)</h2>
      <p>당사는 데이터 최소화 원칙을 지킵니다. rhwp Studio 사용 시, 당사는 귀하의 개인 데이터를 외부 서버에 <strong>수집, 저장, 또는 처리하지 않습니다.</strong> 본 애플리케이션은 귀하가 열거나 저장하고자 하는 파일에 접근하기 위한 목적으로만 표준 OAuth 권한을 요청합니다.</p>
      <p class="en"><strong>2. Information We Collect:</strong> We believe in data minimization. When you use rhwp Studio, we <strong>do not</strong> collect, store, or process your personal data on our servers. We request standard OAuth permissions solely to access files you choose to edit.</p>

      <h2>3. 정보의 사용 방법 (How We Use Your Information)</h2>
      <p>귀하의 Google 계정에서 허용된 권한은 오로지 클라이언트 측(귀하의 웹 브라우저 내부)에서만 다음 목적으로 사용됩니다:</p>
      <ul>
        <li>선택한 HWP/HWPX 파일의 목록 조회 및 다운로드</li>
        <li>편집된 파일을 다시 귀하의 Google Drive로 업로드</li>
      </ul>
      <p>모든 파일 처리는 WebAssembly를 사용하여 로컬에서 이루어집니다. 귀하의 문서는 절대로 브라우저를 벗어나거나 제3자 서버를 거치지 않습니다.</p>
      <p class="en"><strong>3. How We Use Your Information:</strong> Granted permissions are used exclusively client-side to list, download, and upload your selected files to your Google Drive. All processing is local via WebAssembly.</p>

      <h2>4. 데이터 공유 및 공개 (Data Sharing and Disclosure)</h2>
      <p>당사는 귀하의 개인정보나 문서를 제3자에게 판매, 거래, 임대 또는 공유하지 않습니다. 당사 서버에 저장되는 데이터가 없으므로 공유할 데이터 또한 존재하지 않습니다.</p>
      <p class="en"><strong>4. Data Sharing:</strong> We do not sell, trade, rent, or otherwise share your personal information or your documents with any third parties.</p>

      <h2>5. 데이터 보안 (Data Security)</h2>
      <p>모든 문서 렌더링 및 편집이 귀하의 로컬 기기에서만 완전히 이루어지도록 보장하여 보안을 최우선으로 합니다. 인증은 Google의 공식 OAuth 2.0 인프라를 통해 안전하게 처리됩니다.</p>
      <p class="en"><strong>5. Data Security:</strong> We prioritize your security by ensuring that all rendering happens locally. Authentication is handled securely through Google's official OAuth 2.0 infrastructure.</p>

      <h2>6. 사용량 분석 (Analytics)</h2>
      <p>당사는 서비스 개선을 위해 Google Analytics를 사용하여 익명화된 사용량 통계(방문 페이지, 대략적 지역, 기기·브라우저 종류 등)를 수집합니다. 이 과정에서 분석용 쿠키가 사용될 수 있으며, IP 주소는 익명화됩니다. 수집되는 정보에는 귀하의 문서 내용이나 Google Drive 파일이 <strong>일절 포함되지 않습니다.</strong> 자세한 내용은 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a>을 참고하세요.</p>
      <p class="en"><strong>6. Analytics:</strong> We use Google Analytics to collect anonymized usage statistics (pages visited, approximate region, device/browser type) to improve the service. Analytics cookies may be used and IP addresses are anonymized. This data <strong>never</strong> includes your document contents or Google Drive files. See the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> for details.</p>

      <h2>7. 문의 (Contact Us)</h2>
      <p>본 개인정보처리방침에 대해 궁금한 점이 있으시면 다음 이메일로 문의해 주시기 바랍니다: ehsheh@gmail.com</p>
    `,
  )
}
