import { useState } from 'react'
import './App.css'
import Cctv from './component/Cctv'
import CameraConnect, { type CameraItem } from './component/CameraConnect'
import Logistics from './component/Logistics'
import safelogixLogo from './assets/SafeLogiXlogo.png'
import secure from './assets/Secure.png'
import document from './assets/Document.png'
import camera from './assets/camera.png'

type View = 'home' | 'cctv' | 'camera-connect' | 'logistics'

function App() {
  const [view, setView] = useState<View>('home')
  
  // 💡 새롭게 추가하는 로그인 관련 상태들
  const [accessCode, setAccessCode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 휴대폰 카메라 연결 관련 상태
  const [cameras, setCameras] = useState<CameraItem[]>([
  {
    id: 'test-cam-1',
    name: '테스트 웹캠',
    location: '사무실 (내 PC)',
    status: 'offline'
  }
])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [streamUrl, setStreamUrl] = useState('')

  // 💡 로그인 API 호출 함수
  const handleLogin = async () => {
    // 코드가 비어있는지 확인
    if (!accessCode.trim()) {
        alert('접속 코드를 입력해주세요.')
        return
    }

    try {
      const response = await fetch('http://49.172.228.79:8000/login', {
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

  // 카메라 추가
  const handleAddCamera = (camera: { name: string; location: string }) => {
    const newCamera: CameraItem = {
        id: String(Date.now()),
        name: camera.name,
        location: camera.location,
        status: 'offline',
    }

    setCameras((prev) => [...prev, newCamera])
    setSelectedCameraId(newCamera.id)
  }

  // 카메라 선택
  const handleSelectCamera = (id: string) => {
    setSelectedCameraId(id)
    setConnected(false)
    setStreamUrl('')
  }

  // 휴대폰 카메라 연결
  const handleConnect = async () => {
    if (!selectedCameraId) return

    const selectedCamera = cameras.find((cameraItem) => cameraItem.id === selectedCameraId)
    if (!selectedCamera) return

    try {
      const response = await fetch('http://49.172.228.79:8000/camera/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          camera_id: selectedCamera.id,
          name: selectedCamera.name,
          location: selectedCamera.location,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // 백엔드가 포트포워딩된 스트림 주소를 내려준다고 가정
        setStreamUrl(data.stream_url ?? '')
        setConnected(true)

        setCameras((prev) =>
          prev.map((cameraItem) =>
            cameraItem.id === selectedCamera.id
              ? { ...cameraItem, status: 'online' }
              : cameraItem,
          ),
        )
      } else {
          alert('카메라 연결에 실패했습니다.')
      }
    } catch (error) {
        console.error('카메라 연결 에러:', error)
        alert('카메라 서버와 연결할 수 없습니다.')
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
          <div className="home-stage">
              <img src={safelogixLogo} alt="SafeLogiX Logo" className="img-logo" />

              <div className="icon-box secure-pos" onClick={() => setView('cctv')}>
                <img src={secure} alt="Secure" className="img-secure" />
                <p className="icon-text">감시</p>
              </div>

              <div className="icon-box camera-pos" onClick={() => setView('camera-connect')}>
                <img src={camera} alt="Camera" className="img-camera" />
                <p className="icon-text">카메라 연결</p>
              </div>

              <div className="icon-box document-pos" onClick={() => setView('logistics')}>
                <img src={document} alt="Document" className="img-document" />
                <p className="icon-text">문서</p>
              </div>
          </div>
        )}

        {view === 'cctv' && <Cctv onNavigate={setView} />}
        
        {view === 'camera-connect' && (
          <CameraConnect
              title="카메라 연결"
              connectLabel="연결"
              cameras={cameras}
              selectedId={selectedCameraId}
              onSelect={handleSelectCamera}
              onBack={() => setView('home')}
              onConnect={handleConnect}
              onAddCamera={handleAddCamera}
              connected={connected}
              streamUrl={streamUrl}
            />
        )}

        {view === 'logistics' && <Logistics onNavigate={setView} />}
    </div>
  )
}

export default App