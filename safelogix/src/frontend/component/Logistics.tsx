import { useState } from 'react'
import { Boxes, Shield, CalendarDays, FileSpreadsheet, ScanLine, X, FileText, Search } from 'lucide-react'
import './logistics.css'

type View = 'home' | 'cctv' | 'logistics'

interface LogisticsProps {
  onNavigate: (view: View) => void
}

function Logistics({ onNavigate }: LogisticsProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className={showDetail ? 'logistics-container' : 'logistics-container no-detail'}>
      <aside className="logistics-sidebar">
        <h1 className="logistics-logo">SafeLogiX</h1>
        <nav className="logistics-menu">
          <button
            type="button"
            className="logistics-menu-item-logi active"
            onClick={() => onNavigate('logistics')}
          >
            <Boxes size={18} />
            <span>물류 현황</span>
          </button>
          <button
            type="button"
            className="logistics-menu-item-cctv"
            onClick={() => onNavigate('cctv')}
          >
            <Shield size={18} />
            <span>CCTV 기록</span>
          </button>
        </nav>
      </aside>

      <main className="logistics-main">
        <header className="logistics-main-header">
          <h2>물류 및 재고 현황</h2>
          <div className="logistics-main-actions">
            <button type="button" className="logistics-btn-date">
              <CalendarDays size={18} />
              <span>기간 설정</span>
            </button>
            <button type="button" className="logistics-btn-excel">
              <FileSpreadsheet size={18} />
              <span>엑셀 다운로드</span>
            </button>
            <button
              type="button"
              className="logistics-btn-scan"
              onClick={() => setShowDetail(true)}
            >
              <ScanLine size={18} />
              <span>문서 스캔</span>
            </button>
          </div>
        </header>

        <section className="logistics-table-area">
          <div className="logistics-table-head">
            <span>No</span>
            <span>날짜</span>
            <span>품목명</span>
            <span>구분</span>
            <span>수량</span>
            <span>업체명</span>
          </div>
        </section>
      </main>

      {showDetail && (
        <section className="logistics-detail">
          <header className="logistics-detail-header">
            <h3>문서 스캔 및 AI 검수</h3>
            <button
              type="button"
              className="logistics-close-btn"
              onClick={() => setShowDetail(false)}
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </header>

          <div className="logistics-preview">
            <div className="original-preview">
              <div className="preview-center">
                  <FileText size={42} strokeWidth={1.6} />
                  <span>거래명세서 원본 이미지</span>
              </div>

              <button type="button" className="preview-zoom-btn" aria-label="이미지 확대">
                  <Search size={14} />
              </button>
            </div>
          </div>

          <div className="form-container">
            <p className="logistics-ocr-msg">OCR 인식 결과가 여기에 표시됩니다.</p>

            <div className="logistics-form">
              <label>
                업체명
                <input type="text" />
              </label>

              <div className="logistics-form-row">
                <label>
                  품목명
                  <input type="text" />
                </label>
                <label>
                  수량
                  <input type="number" />
                </label>
              </div>
            </div>

            <div className="logistics-detail-actions">
              <button type="button" className="logistics-btn-cancel">취소</button>
              <button type="button" className="logistics-btn-save">검수 완료 및 저장</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Logistics