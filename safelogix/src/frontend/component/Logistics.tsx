import { useState, useRef } from 'react'
import { Boxes, Shield, CalendarDays, FileSpreadsheet, ScanLine, X, FileText, Search, UploadCloud, Loader2 } from 'lucide-react'
import './logistics.css'

type View = 'home' | 'cctv' | 'logistics'

interface LogisticsProps {
  onNavigate: (view: View) => void
}

function Logistics({ onNavigate }: LogisticsProps) {
  const [showDetail, setShowDetail] = useState(false)

  // 업로드 타입 관리 (엑셀인지 이미지인지 구분)
  const [uploadType, setUploadType] = useState<'excel' | 'image' | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({ companyName: '', itemName: '', quantity: '' })
  
  const excelInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 1. 엑셀/CSV 업로드 핸들러
  // 1. 엑셀/CSV 업로드 핸들러
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadType('excel');
    setFileName(file.name);
    setShowDetail(true);
    setIsProcessing(true);

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      // 💡 실제 백엔드 API 호출
      const response = await fetch('http://localhost:8000/upload-excel', { 
        method: 'POST', 
        body: uploadData 
      });
      
      if (!response.ok) throw new Error('엑셀 분석 실패');
      
      const data = await response.json();
      
      // 백엔드 반환값(company_name, item_name, quantity) 매핑
      setFormData({
        companyName: data.company_name || '',
        itemName: data.item_name || '',
        quantity: data.quantity || '0'
      });
    } catch (error) {
      alert("엑셀 파일 처리에 실패했습니다.");
      handleClose();
    } finally {
      setIsProcessing(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // 2. 이미지 스캔(사진으로 추출) 업로드 핸들러
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadType('image');
    setPreviewUrl(URL.createObjectURL(file));
    setShowDetail(true);
    setIsProcessing(true);

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      // 💡 GPT-4o-mini 스캔 API 호출
      const response = await fetch('http://localhost:8000/scan-document', { 
        method: 'POST', 
        body: uploadData 
      });
      
      if (!response.ok) throw new Error('AI 스캔 실패');
      
      const data = await response.json();
      
      setFormData({
        companyName: data.company_name || '',
        itemName: data.item_name || '',
        quantity: data.quantity || '0'
      });
    } catch (error) {
      alert("이미지 인식에 실패했습니다.");
      handleClose();
    } finally {
      setIsProcessing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // 💡 3. 최종 검수 완료 후 DB 저장 핸들러 추가
  const handleSaveToDB = async () => {
    // 로그인 시 저장해둔 user_id나 임시 UUID를 사용 (ERD 외래키 필수값)
    const companyId = localStorage.getItem('user_id') || "00000000-0000-0000-0000-000000000000"; 

    if (!formData.companyName || !formData.itemName) {
      alert("정보를 모두 입력해주세요.");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('http://localhost:8000/save-logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          companyName: formData.companyName,
          itemName: formData.itemName,
          quantity: parseInt(formData.quantity) || 0
        }),
      });

      if (!response.ok) throw new Error('DB 저장 실패');

      alert("성공적으로 저장되었습니다!");
      handleClose(); // 패널 닫기
      // 여기서 현황 목록을 새로고침하는 함수를 호출하면 더욱 좋습니다.
    } catch (error) {
      alert("데이터 저장 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 패널 닫기 및 상태 초기화
  const handleClose = () => {
    setShowDetail(false)
    setTimeout(() => {
      setUploadType(null)
      setPreviewUrl(null)
      setFileName(null)
      setFormData({ companyName: '', itemName: '', quantity: '' })
    }, 300) // 애니메이션 시간 고려
  }

  return (
    <div className={showDetail ? 'logistics-container' : 'logistics-container no-detail'}>
      <aside className="logistics-sidebar">
        <h1 className="logistics-logo">SafeLogiX</h1>
        <nav className="logistics-menu">
          <button type="button" className="logistics-menu-item-logi active" onClick={() => onNavigate('logistics')}>
            <Boxes size={18} /> <span>물류 현황</span>
          </button>
          <button type="button" className="logistics-menu-item-cctv" onClick={() => onNavigate('cctv')}>
            <Shield size={18} /> <span>CCTV 기록</span>
          </button>
        </nav>
      </aside>

      <main className="logistics-main">
        <header className="logistics-main-header">
          <h2>물류 및 재고 현황</h2>
          <div className="logistics-main-actions">
            <button type="button" className="logistics-btn-date">
              <CalendarDays size={18} />
              <span>조회</span>
            </button>

            {/* 숨겨진 엑셀 업로드 Input */}
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              ref={excelInputRef} 
              style={{ display: 'none' }} 
              onChange={handleExcelUpload} 
            />
            {/* 클릭 시 바로 파일 탐색기 호출 */}
            <button 
              type="button" 
              className="logistics-btn-excel" 
              onClick={() => excelInputRef.current?.click()}
            >
              <FileSpreadsheet size={18} />
              <span>문서파일 업로드</span>
            </button>

            {/* 숨겨진 이미지 스캔 Input */}
            <input 
              type="file" 
              accept="image/*" 
              ref={imageInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
            {/* 클릭 시 바로 사진 탐색기 호출 */}
            <button
              type="button"
              className="logistics-btn-scan"
              onClick={() => imageInputRef.current?.click()}
            >
              <ScanLine size={18} />
              <span>사진으로 추출</span>
            </button>
          </div>
        </header>

        <section className="logistics-table-area">
          <div className="logistics-table-head">
            <span>No</span><span>날짜</span><span>품목명</span><span>구분</span><span>수량</span><span>업체명</span>
          </div>
        </section>
      </main>

      {showDetail && (
        <section className="logistics-detail">
          <header className="logistics-detail-header">
            <h3>{uploadType === 'excel' ? '엑셀 문서 검수' : '문서 스캔 및 AI 검수'}</h3>
            <button type="button" className="logistics-close-btn" onClick={handleClose} aria-label="닫기">
              <X size={18} />
            </button>
          </header>

          <div className="logistics-preview">
            <div className="original-preview">
              {uploadType === 'excel' ? (
                // 엑셀 업로드 시 보여줄 화면
                <div className="preview-center">
                  <FileSpreadsheet size={42} strokeWidth={1.6} color="#107c41" />
                  <span style={{ marginTop: '12px', wordBreak: 'break-all', padding: '0 20px' }}>
                    {fileName}
                  </span>
                </div>
              ) : previewUrl ? (
                // 이미지 업로드 시 스캔본 표시
                <img src={previewUrl} alt="스캔본" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                // 기본 대기 화면
                <div className="preview-center">
                  <FileText size={42} strokeWidth={1.6} />
                  <span>파일을 선택해주세요</span>
                </div>
              )}
            </div>

            {/* 패널 내부에서 파일을 다시 올릴 수 있는 버튼 구성 */}
            <button 
              type="button" 
              className="logistics-btn-upload"
              onClick={() => uploadType === 'excel' ? excelInputRef.current?.click() : imageInputRef.current?.click()}
              style={{ marginTop: '10px', width: '100%', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              disabled={isProcessing}
            >
              <UploadCloud size={18} />
              {isProcessing ? '데이터 처리 중...' : '파일 다시 선택하기'}
            </button>
          </div>

          <div className="form-container">
            <p className="logistics-ocr-msg">
              {isProcessing ? (
                <><Loader2 className="animate-spin" size={16} style={{ display: 'inline', marginRight: '5px' }} /> 데이터를 추출하고 있습니다...</>
              ) : (
                '인식 및 추출 결과가 여기에 표시됩니다.'
              )}
            </p>

            <div className="logistics-form">
              <label>
                업체명
                <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} disabled={isProcessing} />
              </label>

              <div className="logistics-form-row">
                <label>
                  품목명
                  <input type="text" name="itemName" value={formData.itemName} onChange={handleInputChange} disabled={isProcessing} />
                </label>
                <label>
                  수량
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} disabled={isProcessing} />
                </label>
              </div>
            </div>

            <div className="logistics-detail-actions">
              <button 
                type="button" 
                className="logistics-btn-cancel" 
                onClick={handleClose}
                disabled={isProcessing}
              >
                취소
              </button>
              
              <button 
                type="button" 
                className="logistics-btn-save" 
                onClick={handleSaveToDB} // 👈 함수 연결
                disabled={isProcessing}
              >
                {isProcessing ? '저장 중...' : '검수 완료 및 저장'}
              </button>
            </div>
                      </div>
                    </section>
                  )}
                </div>
  )
}

export default Logistics