import { getStudioConfig } from '@/services/configuration';
/**
 * Wedding Booking — PDF & Document Generation Engine
 *
 * [한글 폰트 무결성 및 A4 렌더링 핵심 보장 장치]
 * 1. document.fonts.ready 비동기 완료 대기로 시스템/웹 폰트 미로딩에 의한 글자 깨짐 및 치수 어긋남 차단
 * 2. html2canvas 고화질(scale: 2) 래스터라이즈로 모든 국문 자모/합자/특수문자 왜곡 없는 무결성 보장
 * 3. 210mm x 297mm A4 1:1 정밀 좌표 배치
 * 4. 향후 대체 엔진(Puppeteer, pdf-lib 등)으로 즉시 교체 가능하도록 어댑터 인터페이스 제공
 */

export interface GeneratedDocuments {
  pdfBlob: Blob;
  pdfBase64: string;
  jpgBase64?: string; // V1.1 대비 유지
}
export function assertPageFits(page: Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollWidth' | 'clientWidth'>): void {
  if (page.scrollHeight > page.clientHeight + 3 || page.scrollWidth > page.clientWidth + 3) {
    throw new Error('계약서 내용이 페이지 영역을 초과했습니다. 요청사항 길이를 확인한 후 다시 생성해 주세요.');
  }
}
export function assertPrintableBounds(contentBottom: number, printableBottom: number, scale = 1): void {
  if (contentBottom > printableBottom + 2 * scale) {
    throw new Error('계약서 내용이 페이지 영역을 초과했습니다. 인쇄 여백을 확인한 후 다시 생성해 주세요.');
  }
}

export interface IPdfGenerator {
  generatePdf(elementId: string, contractNumber: string, snapshotHash?: string): Promise<GeneratedDocuments>;
}

export class Html2CanvasPdfGenerator implements IPdfGenerator {
  async generatePdf(
    elementId = 'review-contract-doc-preview',
    contractNumber = getStudioConfig().contractPrefix + '-CONTRACT',
    snapshotHash?: string
  ): Promise<GeneratedDocuments> {
    if (typeof window === 'undefined') {
      throw new Error('PDF 생성은 브라우저 환경에서만 실행할 수 있습니다.');
    }

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`계약서 DOM 요소(#${elementId})를 찾을 수 없습니다.`);
    }

    // 1. 한글 웹폰트 및 시스템 폰트 로딩 완료 보장
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (fontErr) {
        console.warn('폰트 로딩 대기 경고:', fontErr);
      }
    }

    // 2. DOM 렌더링 안정화를 위한 틱 대기
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));

    // 3. 모듈 동적 로드 (SSR 호환)
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default;
    const { jsPDF } = await import('jspdf');

    // 4. 멀티페이지 탐색 (.contract-page 또는 [data-pdf-page])
    const pageElements = Array.from(
      element.querySelectorAll<HTMLElement>('.contract-page, [data-pdf-page]')
    );

    const targets = pageElements.length > 0 ? pageElements : [element];

    // 5. A4 세로 PDF 생성 (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.setProperties({ title: contractNumber, subject: snapshotHash ? `contract-snapshot:${snapshotHash}` : contractNumber });
    const pdfWidth = 210;
    const pdfHeight = 297;
    let firstPageJpg = '';

    for (let i = 0; i < targets.length; i++) {
      const pageEl = targets[i];
      assertPageFits(pageEl);
      const bounds = pageEl.getBoundingClientRect();
      const scale = bounds.height / pageEl.offsetHeight;
      const style = getComputedStyle(pageEl);
      const printableBottom = bounds.bottom - (parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)) * scale;
      for (const child of Array.from(pageEl.children)) {
        if (child instanceof HTMLElement && child.offsetHeight) assertPrintableBounds(child.getBoundingClientRect().bottom, printableBottom, scale);
      }

      // 350 DPI 인쇄소 출판급 초고해상도 렌더링 (확대 시 픽셀 깨짐 제로화)
      const canvas = await html2canvas(pageEl, {
        scale: 3.5, // 기존 2배율(192 DPI) -> 3.5배율(약 350 DPI 초고화질)
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // 복제된 DOM에 폰트 스무딩 및 기하학적 텍스트 렌더링 강제 주입
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              -webkit-font-smoothing: antialiased !important;
              -moz-osx-font-smoothing: grayscale !important;
              text-rendering: geometricPrecision !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      // 무손실 PNG 인코딩으로 JPEG 압축 노이즈(글자 번짐) 완전 차단
      const imgDataUrl = canvas.toDataURL('image/png');

      if (i === 0) {
        firstPageJpg = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');
      } else {
        pdf.addPage();
        pdf.addImage(imgDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');
      }
    }

    const pdfBlob = pdf.output('blob');
    const pdfBase64 = pdf.output('datauristring');

    return {
      pdfBlob,
      pdfBase64,
      jpgBase64: firstPageJpg,
    };
  }
}

// 기본 싱글톤 인스턴스
const defaultGenerator = new Html2CanvasPdfGenerator();

export async function exportContractToPdfAndJpg(
  elementId = 'review-contract-doc-preview',
  contractNumber = getStudioConfig().contractPrefix + '-CONTRACT',
  snapshotHash?: string
): Promise<GeneratedDocuments> {
  return defaultGenerator.generatePdf(elementId, contractNumber, snapshotHash);
}

/**
 * 브라우저에서 파일 다운로드 트리거
 */
export function triggerFileDownload(blobOrUrl: Blob | string, filename: string): void {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof blobOrUrl !== 'string') {
    URL.revokeObjectURL(url);
  }
}
