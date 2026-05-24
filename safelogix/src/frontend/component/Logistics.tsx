import { useState, useRef, useEffect } from 'react'
import { Boxes, Shield, CalendarDays, FileSpreadsheet, ScanLine, X, FileText, UploadCloud, Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react'
import './logistics.css'

type View = 'home' | 'cctv' | 'logistics'

interface LogisticsProps {
  onNavigate: (view: View) => void
}

function Logistics({ onNavigate }: LogisticsProps) {
  const [showDetail, setShowDetail] = useState(false)

  const [uploadType, setUploadType] = useState<'excel' | 'image' | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)

  const [isProcessing, setIsProcessing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  // 💡 변경: 상태에 'type' 추가 (기본값: '입고')
  const [formDataList, setFormDataList] = useState([{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
  
  const excelInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [savedItems, setSavedItems] = useState<any[]>([]);

  const fetchLogistics = async () => {
    const companyId = localStorage.getItem('company_id');
    if (!companyId) return;

    try {
      const response = await fetch(`http://localhost:8000/logistics-list?company_id=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setSavedItems(data.items);
      }
    } catch (error) {
      console.error("데이터 불러오기 에러:", error);
    }
  };

  useEffect(() => {
    fetchLogistics();
  }, []);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadType('excel');
    setFileName(file.name);
    setCurrentFile(file); 
    setShowDetail(true);
    setIsProcessing(true);

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload-excel', { 
        method: 'POST', 
        body: uploadData 
      });
      
      if (!response.ok) throw new Error('엑셀 파싱 실패')
      
      const data = await response.json();
      const newItems = data.items.map((item: any) => ({
        companyName: item.company_name || '',
        itemName: item.item_name || '',
        quantity: String(item.quantity) || '0',
        type: item.type || '입고' // 💡 변경: 추출된 구분 값 매핑
      }));
      setFormDataList(newItems.length > 0 ? newItems : [{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
    
    } catch (error) {
      alert("엑셀 파일 처리에 실패했습니다.");
      setFormDataList([{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
    } finally {
      setIsProcessing(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadType('image');
    setPreviewUrl(URL.createObjectURL(file));
    setCurrentFile(file);
    setShowDetail(true);
    setIsProcessing(true);

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/scan-document', { 
        method: 'POST', 
        body: uploadData 
      });
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || '인식 실패')
      }
      
      const data = await response.json();
      const newItems = data.items.map((item: any) => ({
        companyName: item.company_name || '',
        itemName: item.item_name || '',
        quantity: String(item.quantity) || '0',
        type: item.type || '입고' // 💡 변경: AI 스캔 구분 값 매핑
      }));

      setFormDataList(newItems.length > 0 ? newItems : [{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
    
    } catch (error: any) {
      console.error("OCR Error:", error)
      alert(`이미지 인식 실패: ${error.message}`)
      setFormDataList([{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
    } finally {
      setIsProcessing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleReExtract = async () => {
    if (!currentFile || !uploadType) {
      alert("다시 추출할 파일이 없습니다.");
      return;
    }

    setIsProcessing(true);
    setFormDataList([{ companyName: '', itemName: '', quantity: '', type: '입고' }]);

    const uploadData = new FormData();
    uploadData.append('file', currentFile);

    try {
      const endpoint = uploadType === 'excel' ? '/upload-excel' : '/scan-document';
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) throw new Error('재추출 실패');

      const data = await response.json();
      const newItems = data.items.map((item: any) => ({
        companyName: item.company_name || '',
        itemName: item.item_name || '',
        quantity: String(item.quantity) || '0',
        type: item.type || '입고' // 💡 변경: 재추출 구분 값 매핑
      }));

      setFormDataList(newItems.length > 0 ? newItems : [{ companyName: '', itemName: '', quantity: '', type: '입고' }]);
    } catch (error) {
      alert("재추출 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToDB = async () => {
  const companyId = localStorage.getItem('company_id');
  if (!companyId) {
    alert("로그인 정보가 없습니다.");
    return;
  }

  setIsProcessing(true);
  try {
    for (const item of formDataList) {
      const formData = new FormData();
      formData.append('company_id', companyId);
      formData.append('vendorName', item.companyName);
      formData.append('itemName', item.itemName);
      formData.append('quantity', item.quantity);
      formData.append('type', item.type === '출고' ? 'OUT' : 'IN');
      
      // 파일이 있을 경우에만 첨부
      if (currentFile) {
        formData.append('file', currentFile);
      }

      const response = await fetch('http://localhost:8000/save-logistics', {
        method: 'POST',
        body: formData, // FormData 사용 시 헤더 설정 불필요
      });

      if (!response.ok) throw new Error('저장 실패');
    }

    alert("성공적으로 저장되었습니다.");
    handleClose();
    fetchLogistics(); // 목록 새로고침

  } catch (error) {
    console.error("Save Error:", error);
    alert("저장 중 오류가 발생했습니다.");
  } finally {
    setIsProcessing(false);
  }
};

  // 💡 변경: Select 태그도 감지할 수 있도록 타입 확장
  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormDataList(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], [name]: value };
      return newList;
    });
  }

  const handleAddItem = () => {
    setFormDataList(prev => [...prev, { companyName: '', itemName: '', quantity: '0', type: '입고' }]);
  }

  const handleDeleteItem = (indexToRemove: number) => {
    setFormDataList(prev => prev.filter((_, index) => index !== indexToRemove));
  }

  const handleClose = () => {
    setShowDetail(false)
    setTimeout(() => {
      setUploadType(null)
      setPreviewUrl(null)
      setFileName(null)
      setCurrentFile(null)
      setFormDataList([{ companyName: '', itemName: '', quantity: '', type: '입고' }])
    }, 300) 
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

            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              ref={excelInputRef} 
              style={{ display: 'none' }} 
              onChange={handleExcelUpload} 
            />
            <button 
              type="button" 
              className="logistics-btn-excel" 
              onClick={() => excelInputRef.current?.click()}
            >
              <FileSpreadsheet size={18} />
              <span>문서파일 업로드</span>
            </button>

            <input 
              type="file" 
              accept="image/*" 
              ref={imageInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
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
          {/* 💡 1. 헤더와 본문의 줄맞춤을 위해 헤더에도 Grid 속성을 동일하게 부여합니다. */}
          <div 
            className="logistics-table-head" 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '0.5fr 1fr 2fr 1fr 1fr 1.5fr', // 컬럼 너비 비율 (No는 좁게, 품목명은 넓게)
              textAlign: 'center', 
              fontWeight: 'bold',
              padding: '15px',
              backgroundColor: '#f8fafc',
              borderBottom: '2px solid #e2e8f0'
            }}
          >
            <span>No</span>
            <span>날짜</span>
            <span>품목명</span>
            <span>구분</span>
            <span>수량</span>
            <span>업체명</span>
          </div>

          <div className="logistics-table-body" style={{ display: 'flex', flexDirection: 'column' }}>
            {savedItems.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                저장된 물류 데이터가 없습니다.
              </div>
            ) : (
              savedItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '0.5fr 1fr 2fr 1fr 1fr 1.5fr', // 💡 2. 헤더와 완벽히 동일한 비율 적용
                    padding: '15px', 
                    borderBottom: '1px solid #f1f5f9', 
                    textAlign: 'center',
                    alignItems: 'center',
                    color: '#334155' 
                  }}
                >
                  <span>{index + 1}</span>
                  
                  {/* 💡 3. inventory_logs 테이블의 logged_at 사용 (없으면 created_at) */}
                  <span>{item.logged_at ? new Date(item.logged_at).toLocaleDateString() : '-'}</span>
                  
                  {/* 💡 4. inventory_logs 테이블의 item_name */}
                  <span>{item.item_name || '-'}</span>
                  
                  {/* 💡 5. inventory_logs 테이블의 type */}
                  <span style={{ color: item.type === 'OUT' || item.type === '출고' ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                    {item.type === 'OUT' || item.type === '출고' ? '출고' : '입고'}
                  </span>
                  
                  {/* 💡 6. inventory_logs 테이블의 quantity */}
                  <span>{item.quantity || '0'}</span>
                  
                  {/* 💡 7. logistics_documents 테이블의 vendor_name */}
                  <span>{item.logistics_documents?.vendor_name || '-'}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {showDetail && (
        <section className="logistics-detail">
          
          <header className="logistics-detail-header" style={{ flexShrink: 0 }}>
            <h3>{uploadType === 'excel' ? '엑셀 문서 검수' : '문서 스캔 및 AI 검수'}</h3>
            <button type="button" className="logistics-close-btn" onClick={handleClose} aria-label="닫기">
              <X size={18} />
            </button>
          </header>

          <div className="logistics-preview" style={{ flexShrink: 0 }}>
            <div className="original-preview">
              {uploadType === 'excel' ? (
                <div className="preview-center">
                  <FileSpreadsheet size={42} strokeWidth={1.6} color="#107c41" />
                  <span style={{ marginTop: '12px', wordBreak: 'break-all', padding: '0 20px' }}>
                    {fileName}
                  </span>
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="스캔본" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="preview-center">
                  <FileText size={42} strokeWidth={1.6} />
                  <span>파일을 선택해주세요</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button 
                type="button" 
                className="logistics-btn-upload"
                onClick={() => uploadType === 'excel' ? excelInputRef.current?.click() : imageInputRef.current?.click()}
                style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                disabled={isProcessing}
              >
                <UploadCloud size={18} /> 다른 파일 선택
              </button>

              <button 
                type="button" 
                className="logistics-btn-upload"
                onClick={handleReExtract}
                style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}
                disabled={isProcessing}
              >
                <RefreshCw size={18} className={isProcessing ? "animate-spin" : ""} /> 다시 추출하기
              </button>
            </div>
          </div>

          <div className="form-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', marginTop: '15px' }}>
            <p className="logistics-ocr-msg" style={{ marginBottom: '10px', flexShrink: 0 }}>
              {isProcessing ? (
                <><Loader2 className="animate-spin" size={16} style={{ display: 'inline', marginRight: '5px' }} /> 데이터를 추출하고 있습니다...</>
              ) : (
                <span style={{ color: '#2563eb', fontWeight: 'bold' }}>
                  ✅ 총 {formDataList.length}개의 항목이 인식되었습니다.
                </span>
              )}
            </p>

            <div className="logistics-form" style={{ paddingRight: '5px', paddingBottom: '20px' }}>
              {formDataList.map((data, index) => (
                <div key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#666', fontWeight: 'bold' }}>항목 #{index + 1}</span>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteItem(index)}
                      disabled={isProcessing}
                      style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>

                  <label>
                    업체명
                    <input 
                      type="text" 
                      name="companyName" 
                      value={data.companyName} 
                      onChange={(e) => handleInputChange(index, e)} 
                      disabled={isProcessing} 
                    />
                  </label>

                  {/* 💡 변경: 품목명, 구분, 수량이 한 줄에 예쁘게 보이도록 수정 */}
                  <div className="logistics-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <label>
                      품목명
                      <input 
                        type="text" 
                        name="itemName" 
                        value={data.itemName} 
                        onChange={(e) => handleInputChange(index, e)} 
                        disabled={isProcessing} 
                      />
                    </label>
                    <label>
                      구분
                      <select 
                        name="type" 
                        value={data.type} 
                        onChange={(e) => handleInputChange(index, e)} 
                        disabled={isProcessing}
                        style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', marginTop: '5px', backgroundColor: '#fff' }}
                      >
                        <option value="입고">입고</option>
                        <option value="출고">출고</option>
                      </select>
                    </label>
                    <label>
                      수량
                      <input 
                        type="number" 
                        name="quantity" 
                        value={data.quantity} 
                        onChange={(e) => handleInputChange(index, e)} 
                        disabled={isProcessing} 
                      />
                    </label>
                  </div>
                </div>
              ))}

              <button 
                type="button" 
                onClick={handleAddItem}
                disabled={isProcessing}
                style={{ width: '100%', padding: '12px', marginTop: '5px', border: '1px dashed #cbd5e1', borderRadius: '6px', background: '#f8fafc', color: '#475569', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Plus size={16} /> 새 항목 추가하기
              </button>
            </div>
          </div>

          <div className="logistics-detail-actions" style={{ flexShrink: 0, padding: '15px 0', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
            <button 
              type="button" 
              className="logistics-btn-cancel" 
              onClick={handleClose}
              disabled={isProcessing}
              style={{ flex: 1 }}
            >
              취소
            </button>
            
            <button 
              type="button" 
              className="logistics-btn-save" 
              onClick={handleSaveToDB}
              disabled={isProcessing || formDataList.length === 0}
              style={{ flex: 2 }}
            >
              {isProcessing ? '저장 중...' : '검수 완료 및 전체 저장'}
            </button>
          </div>
          
        </section>
      )}
    </div>
  )
}

export default Logistics