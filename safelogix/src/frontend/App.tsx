import { useState } from 'react'
import './App.css'
import Cctv from './component/Cctv'
import Logistics from './component/Logistics'
import safelogixLogo from './assets/SafeLogiXlogo.png'
import secure from './assets/Secure.png'
import document from './assets/Document.png'

type View = 'home' | 'cctv' | 'logistics'

function App() {
  const [view, setView] = useState<View>('home')
  
  // 💡 새롭게 추가하는 로그인 관련 상태들
  const [accessCode, setAccessCode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 💡 로그인 API 호출 함수
  const handleLogin = async () => {
    // 코드가 비어있는지 확인
    if (!accessCode.trim()) {
      alert('접속 코드를 입력해주세요.')
      return
    }

    try {
      const response = await fetch('https://integer-too-sends-limitations.trycloudflare.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_code: accessCode }),
      })

      if (response.ok) {
        const data = await response.json()
        // 발급받은 출입증(토큰)을 브라우저 로컬 저장소에 안전하게 보관합니다.
        localStorage.setItem('access_token', data.access_token)
        setIsAuthenticated(true) // 로그인 상태로 변경
      } else {
        alert('유효하지 않은 접속 코드입니다.')
      }
    } catch (error) {
      console.error('로그인 에러:', error)
      alert('서버와 연결할 수 없습니다. 백엔드 서버가 켜져 있는지 확인해주세요.')
    }
  }

  // 💡 1. 로그인이 안 되어 있다면 로그인 화면을 렌더링합니다.
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <img 
            src={safelogixLogo} 
            alt="SafeLogiX Logo" 
            className="img-logo" 
          />
          <h2 style={{ color: '#333', marginTop: '40px' }}>현장 작업자 로그인</h2>
          <div style={{ marginTop: '30px' }}>
            <input 
              type="text" 
              placeholder="접속 코드를 입력하세요" 
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{ padding: '12px 16px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc', width: '300px' }}
            />
            <button 
              onClick={handleLogin} 
              style={{ padding: '12px 24px', marginLeft: '10px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '5px' }}
            >
              접속하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 💡 2. 로그인이 완료되었다면 기존에 만드신 메인 화면을 렌더링합니다.
  return (
    <div className="app">
        {view === 'home' && (
          <>
            <img
              src={safelogixLogo}
              alt="SafeLogiX Logo"
              className="img-logo"
            />

            <div className="icon-box secure-pos" onClick={() => setView('cctv')}>
              <img src={secure} alt="Secure" className="img-secure" />
              <p className="icon-text">감시</p>
            </div>

            <div className="icon-box document-pos" onClick={() => setView('logistics')}>
              <img src={document} alt="Document" className="img-document" />
              <p className="icon-text">문서</p>
            </div>
          </>
        )}

        {view === 'cctv' && <Cctv onNavigate={setView} />}
        {view === 'logistics' && <Logistics onNavigate={setView} />}
    </div>
  )
}

export default App