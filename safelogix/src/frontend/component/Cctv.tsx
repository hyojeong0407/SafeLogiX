import { useState } from 'react'
import { Boxes, ShieldAlert, Funnel, Download, X } from 'lucide-react'
import './Cctv.css'

type View = 'home' | 'cctv' | 'logistics'

interface CctvProps {
  onNavigate: (view: View) => void
}

function Cctv({ onNavigate }: CctvProps) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className={showDetail ? 'cctv-container' : 'cctv-container no-detail'}>
      <aside className="cctv-sidebar">
        <h1 className="cctv-logo">SafeLogiX</h1>
        <nav className="cctv-menu">
          <button
            type="button"
            className="cctv-menu-item-logi"
            onClick={() => onNavigate('logistics')}
          >
            <Boxes size={18} />
            <span>물류 현황</span>
          </button>

          <button
            type="button"
            className="cctv-menu-item-cctv active"
            onClick={() => onNavigate('cctv')}
          >
            <ShieldAlert size={18} />
            <span>CCTV 기록</span>
          </button>
        </nav>
      </aside>

      <main className="cctv-main">
        <header className="cctv-main-header">
          <h2>AI 위험 감지 로그</h2>
          <div className="cctv-main-actions">
            <button
              type="button"
              className="btn-filter"
              onClick={() => setShowDetail(true)}
            >
              <Funnel size={18} />
              <span>위험 필터</span>
            </button>

            <button type="button" className="btn-download">
              <Download size={18} />
              <span>안전 보고서 다운로드</span>
            </button>
          </div>
        </header>

        <section className="cctv-table-area">
          <div className="cctv-table-head">
            <span>No</span>
            <span>감지 시간</span>
            <span>카메라 위치</span>
            <span>위험 분류</span>
            <span>상태</span>
          </div>
        </section>
      </main>

      {showDetail && (
        <section className="cctv-detail">
          <header className="cctv-detail-header">
            <h3>위험 기록 상세 검수</h3>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowDetail(false)}
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </header>

          <div className="cctv-preview">이미지/스냅샷 영역</div>

          <div className="record-container">
            <div className="cctv-info">
              <p>감지내용: </p>
              <p>발생시간: </p>
            </div>

            <div className="state-box">
              <p className="label">관리자 검수 상태</p>
              <div className="state-actions">
                <button type="button" className="state-btn">미확인</button>
                <button type="button" className="state-btn active">경고 확정</button>
                <button type="button" className="state-btn">오탐지/정상</button>
              </div>
            </div>

            <div className="memo-box">
              <p className="label">조치사항 및 메모</p>
              <textarea placeholder="작업자에게 경고 조치함." />
            </div>

            <button type="button" className="update-btn">기록 업데이트</button>
          </div>
        </section>
      )}
    </div>
  )
}

export default Cctv