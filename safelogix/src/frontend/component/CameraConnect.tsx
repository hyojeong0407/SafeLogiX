import { useState, useRef, useEffect } from 'react'
import { Camera, Link2, ArrowLeft, Plus } from 'lucide-react'
import './CameraConnect.css'

export type CameraItem = {
    id: string
    name: string
    location: string
    status: 'online' | 'offline'
}

interface CameraConnectProps {
    title?: string
    connectLabel?: string
    cameras?: CameraItem[]
    selectedId?: string | null
    onSelect?: (id: string) => void
    onBack?: () => void
    onConnect?: () => void
    onAddCamera?: (camera: { name: string; location: string }) => void
    connected?: boolean
    streamUrl?: string
}

function CameraConnect({
    title = '카메라 연결',
    connectLabel = '연결',
    cameras = [],
    selectedId = null,
    onSelect = () => {},
    onConnect = () => {},
    onBack = () => {},
    onAddCamera = () => {},
    connected = false,
    streamUrl = '',
}: CameraConnectProps) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  
  // 💡 비디오 태그를 직접 제어하기 위한 참조(ref) 추가
  const videoRef = useRef<HTMLVideoElement>(null)

  const selected = cameras.find((c) => c.id === selectedId)

  const handleAdd = () => {
    if (!name.trim() || !location.trim()) return
    onAddCamera({ name: name.trim(), location: location.trim() })
    setName('')
    setLocation('')
  }

  // 💡 연결 상태가 바뀌면 카메라를 켜는 로직 추가
  useEffect(() => {
    if (connected && videoRef.current) {
        // streamUrl이 '0'이거나 비어있으면 로컬 웹캠을 켭니다.
        if (streamUrl === '0' || !streamUrl.startsWith('http')) {
            navigator.mediaDevices
                .getUserMedia({ video: true })
                .then((stream) => {
                    if (videoRef.current) {
                        // src가 아닌 srcObject에 카메라 스트림을 연결합니다.
                        videoRef.current.srcObject = stream
                    }
                })
                .catch((error) => {
                    console.error('카메라 접근 에러:', error)
                    alert('카메라 접근 권한을 허용해주세요!')
                })
        } else {
            // 실제 인터넷 영상 주소(.mp4 등)가 오면 src에 바로 넣습니다.
            videoRef.current.src = streamUrl
        }
    }

    // 컴포넌트가 꺼지거나 연결이 해제되면 카메라 끄기
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach((track) => track.stop())
        }
    }
  }, [connected, streamUrl])

  return (
    <section className="camera-connect">
      <header className="camera-connect-header">
        <h3>{title}</h3>
        <button type="button" className="camera-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>돌아가기</span>
        </button>
      </header>

      <div className="camera-connect-body">
        <div className="camera-preview">
          <div className="camera-preview-center">
            {connected ? (
              streamUrl && streamUrl.startsWith('http') ? (
                <img
                  src={streamUrl}
                  alt="Smartphone Stream"
                  className="camera-preview-video"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    console.error("스트리밍 주소 오류:", streamUrl);
                    alert("영상을 불러올 수 없습니다. 주소를 확인해주세요.");
                  }}
                />
              ) : (
              // 💡 ref={videoRef} 를 추가하여 카메라 화면을 연결합니다.
              <video
                  ref={videoRef}
                  className="camera-preview-video"
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              )
            ) : (
              <>
                <Camera size={44} />
                <p className="preview-title">
                    {selected ? selected.name : '카메라를 선택하세요'}
                </p>
                <p className="preview-sub">
                    {selected ? selected.location : '오른쪽 목록에서 선택'}
                </p>
              </>
            )}

            <button
                type="button"
                className="camera-connect-btn"
                onClick={onConnect}
                disabled={!selectedId}
            >
              <Link2 size={16} />
              <span>{connected ? '연결됨' : connectLabel}</span>
            </button>
          </div>
        </div>

        <div className="camera-list-wrap">
          <div className="camera-add-form">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="카메라 이름"
            />
            <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="위치"
            />
            <button type="button" onClick={handleAdd}>
                <Plus size={16} />
                <span>추가</span>
            </button>
          </div>

          <div className="camera-list-head">
              <span>이름</span>
              <span>위치</span>
              <span>상태</span>
          </div>

          <div className="camera-list-body">
            {cameras.length === 0 && (
                <div className="camera-empty">등록된 카메라가 없습니다.</div>
            )}
            {cameras.map((cam) => (
              <button
                  key={cam.id}
                  type="button"
                  className={selectedId === cam.id ? 'camera-row active' : 'camera-row'}
                  onClick={() => onSelect(cam.id)}
              >
                <span>{cam.name}</span>
                <span>{cam.location}</span>
                <span className={cam.status === 'online' ? 'status-on' : 'status-off'}>
                    {cam.status === 'online' ? '정상' : '오프라인'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CameraConnect