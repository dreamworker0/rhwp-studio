import { renderLegalPage } from '../components/ui'

export function renderSupport(container: HTMLElement) {
  container.innerHTML = renderLegalPage(
    '고객 지원 (Support)',
    'rhwp Studio 앱을 이용해 주셔서 감사합니다.',
    `
      <p>앱 사용 중 발생하는 오류, 설치 관련 문의 및 기타 질문 사항이 있으시다면 아래의 연락처로 문의해 주시기 바랍니다. 확인 후 최대한 빠르게 답변해 드리겠습니다.</p>

      <div class="support-card">
        <p class="label">고객 지원 이메일 (Contact Email)</p>
        <a href="mailto:ehsheh@gmail.com">ehsheh@gmail.com</a>
      </div>
    `,
  )
}
