import { useState, useEffect } from 'react'
import { Boxes, ShieldAlert, Funnel, Download, X, Search, ArrowLeft } from 'lucide-react'
import './Cctv.css'

type View = 'home' | 'cctv' | 'logistics'

interface CctvProps {
  onNavigate: (view: View) => void
}

interface SafetyLog {
  id: number;
  detected_at: string;
  camera_id: number;
  violation_type: string;
  status: string | null;
  admin_memo: string | null;
  snapshot_url: string;
  cameras: {
    location_name: string;
  } | null;
}

function Cctv({ onNavigate }: CctvProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [logs, setLogs] = useState<SafetyLog[]>([])
  const [selectedLog, setSelectedLog] = useState<SafetyLog | null>(null)
  
  // 새로 추가된 상태값
  const [searchTerm, setSearchTerm] = useState('') // 검색창 상태
  const [editStatus, setEditStatus] = useState('미확인') // 상세창에서 변경할 상태
  const [memo, setMemo] = useState('') // 조치사항 메모 (admin_memo에 매핑)

  // DB에서 데이터 가져오기
  const fetchLogs = async () => {
    try {
      const companyId = localStorage.getItem('company_id') || 'YOUR_COMPANY_ID'; 
      const response = await fetch(`http://localhost:8000/api/safety-logs?company_id=${companyId}`);
      
      if (!response.ok) throw new Error('데이터를 불러오지 못했습니다.');
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('로그 조회 에러:', error);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  // 테이블 행 클릭 시 상세창 열기
  const handleRowClick = (log: SafetyLog) => {
    setSelectedLog(log);
    setEditStatus(log.status || '미확인'); // 기존 상태값 불러오기
    setMemo(log.admin_memo || ''); // 기존 DB의 admin_memo 불러오기
    setShowDetail(true);
  };

  // 기록 업데이트 기능 (DB 저장)
  const handleUpdateLog = async () => {
    if (!selectedLog) return;

    try {
      const response = await fetch(`http://localhost:8000/api/safety-logs/${selectedLog.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: editStatus,
          admin_memo: memo // 실제 테이블 속성명인 admin_memo로 전송
        }),
      });

      if (!response.ok) throw new Error('업데이트에 실패했습니다.');

      alert('검수 상태가 업데이트되었습니다.');
      
      // 목록 새로고침 & UI 반영
      fetchLogs(); 
      setShowDetail(false);

    } catch (error) {
      console.error('업데이트 에러:', error);
      alert('업데이트 중 오류가 발생했습니다.');
    }
  };

  // AI 안전 보고서 다운로드 기능
  const handleDownloadReport = async () => {
    try {
      const companyId = localStorage.getItem('company_id') || 'YOUR_COMPANY_ID';

      // 파일 다운로드 시작을 사용자에게 알림
      alert('AI가 현장 데이터를 분석하여 보고서를 작성 중입니다. 잠시만 기다려주세요.');

      const response = await fetch(`http://localhost:8000/api/download-safety-report?company_id=${companyId}`);

      if (!response.ok) throw new Error('보고서 다운로드에 실패했습니다.');

      // 바이너리 파일(Blob)로 받아와서 가상의 a태그로 강제 다운로드 트리거
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SafeLogiX_AI_안전보고서.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('보고서 다운로드 에러:', error);
      alert('보고서 생성 중 오류가 발생했습니다.');
    }
  };

  // 검색어에 따른 리스트 필터링 (No 기준 숫자 검색)
  const filteredLogs = logs.filter(log => 
    searchTerm ? log.id.toString().includes(searchTerm) : true
  );

  return (
    <div className={showDetail ? 'cctv-container' : 'cctv-container no-detail'}>
      <aside className="cctv-sidebar">
        <h1 className="cctv-logo">SafeLogiX</h1>
        <nav className="cctv-menu">
          <button type="button" className="cctv-menu-item-logi" onClick={() => onNavigate('logistics')}>
            <Boxes size={18} /><span>물류 현황</span>
          </button>
          <button type="button" className="cctv-menu-item-cctv active" onClick={() => onNavigate('cctv')}>
            <ShieldAlert size={18} /><span>CCTV 기록</span>
          </button>
        </nav>
      </aside>

      <main className="cctv-main">
        <header className="cctv-main-header">
          <h2>AI 위험 감지 로그</h2>
          
          <button
            type="button"
            className="cctv-back-btn"
            onClick={() => onNavigate('home')}
          >
            <ArrowLeft size={16} />
            <span>돌아가기</span>
          </button>

          <div className="cctv-main-actions">
            {/* 검색창 영역 */}
            <div className="search-bar">
              <Search size={18} color="#888" />
              <input 
                type="text" 
                placeholder="NO 검색 (숫자)" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', outline: 'none', padding: '8px', fontSize: '14px', width: '120px' }}
              />
            </div>

            {/* 위험 필터 버튼 클릭 시 우측 창을 먼저 띄웁니다 */}
            <button type="button" className="btn-filter" onClick={() => setShowDetail(true)}>
              <Funnel size={18} /><span>위험 필터</span>
            </button>
            <button 
              type="button" 
              className="btn-download"
              onClick={handleDownloadReport}
            >
              <Download size={18} /><span>안전 보고서 다운로드</span>
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
          
          <div className="cctv-table-body">
            {filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="cctv-table-row" 
                onClick={() => handleRowClick(log)}
                style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '12px 0', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}
              >
                <span>{log.id}</span>
                <span>{formatDate(log.detected_at)}</span>
                <span>{log.cameras?.location_name || `Camera ${log.camera_id}`}</span>
                <span>안전모 미착용</span>
                <span style={{ fontWeight: log.status === '경고 확정' ? 'bold' : 'normal', color: log.status === '경고 확정' ? '#e74c3c' : 'inherit' }}>
                  {log.status || '미확인'}
                </span>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 우측 상세 검수 창 (showDetail이 true면 무조건 렌더링되도록 수정) */}
      {showDetail && (
        <section className="cctv-detail">
          <header className="cctv-detail-header">
            <h3>위험 기록 상세 검수</h3>
            <button type="button" className="close-btn" onClick={() => setShowDetail(false)}>
              <X size={18} />
            </button>
          </header>

          {/* 선택된 로그 데이터(selectedLog)가 아직 없을 때의 예외 처리 */}
          {!selectedLog ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: 'calc(100% - 60px)', 
              color: '#888',
              textAlign: 'center',
              padding: '20px'
            }}>
              <p>좌측 목록에서 상세 검수할 기록을 선택해 주세요.</p>
            </div>
          ) : (
            <>
              {/* 스냅샷 이미지 영역 */}
              <div className="cctv-preview" style={{ 
                height: '250px', 
                background: '#0B132B' ,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#888'
              }}>
                {selectedLog.snapshot_url ? (
                  <img 
                    src={selectedLog.snapshot_url} 
                    alt="위험 감지 이미지" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                ) : (
                  <p>스냅샷 이미지가 없습니다.</p>
                )}
              </div>

              <div className="record-container">
                <div className="cctv-info">
                  <p><strong>감지내용:</strong> 안전모 미착용</p>
                  <p><strong>발생시간:</strong> {formatDate(selectedLog.detected_at)}</p>
                </div>

                <div className="state-box">
                  <p className="label">관리자 검수 상태</p>
                  <div className="state-actions">
                    <button 
                      type="button" 
                      className={`state-btn ${editStatus === '미확인' ? 'active' : ''}`}
                      onClick={() => setEditStatus('미확인')}
                    >
                      미확인
                    </button>
                    <button 
                      type="button" 
                      className={`state-btn ${editStatus === '경고 확정' ? 'active' : ''}`}
                      onClick={() => setEditStatus('경고 확정')}
                    >
                      경고 확정
                    </button>
                    <button 
                      type="button" 
                      className={`state-btn ${editStatus === '오탐지/정상' ? 'active' : ''}`}
                      onClick={() => setEditStatus('오탐지/정상')}
                    >
                      오탐지/정상
                    </button>
                  </div>
                </div>

                <div className="memo-box">
                  <p className="label">조치사항 및 메모</p>
                  <textarea 
                    placeholder="작업자에게 경고 조치함." 
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </div>

                <button type="button" className="update-btn" onClick={handleUpdateLog}>
                  기록 업데이트
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default Cctv