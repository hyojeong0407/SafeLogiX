import './Cctv.css'

function Cctv() {
    return (
        <div className="cctv-container">
            <aside className="cctv-sidebar">
                <h1 className="cctv-logo">SafeLogiX</h1>
                <nav className="cctv-menu">
                    <button type="button" className="cctv-menu-item">물류 현황</button>
                    <button type="button" className="cctv-menu-item-cctv">CCTV 기록</button>
                </nav>
            </aside>

            <main className="cctv-main">
                <header className="cctv-main-header">
                    <h2>AI 위험 감지 로그</h2>
                    <div className="cctv-main-actions">
                        <button type="button" className="btn-filter">위험 필터</button>
                        <button type="button" className="btn-download">안전 보고서 다운로드</button>
                    </div>
                </header>

                <section className="cctv-table-area">
                    <div className="table-head">
                        <span>No</span>
                        <span>감지 시간</span>
                        <span>카메라 위치</span>
                        <span>위험 분류</span>
                        <span>상태</span>
                    </div>
                </section>
            </main>

            <section className="cctv-detail">
                <header className="cctv-detail-header">
                    <h3>위험 기록 상세 검수</h3>
                    <button type="button" className="close-btn">X</button>
                </header>

                <div className="cctv-preview">이미지/스냅샷 영역</div>

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
            </section>
        </div>
    );
}

export default Cctv;