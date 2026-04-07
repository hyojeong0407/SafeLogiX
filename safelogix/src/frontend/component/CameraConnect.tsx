import { useState } from 'react'
import { Camera, Link2, ArrowLeft, Plus } from 'lucide-react'
import './CameraConnect.css'

export type CameraItem = {
    id: string
    name: string
    location: string
    status: 'online' | 'offline'
}

// 부모 컴포넌트에서 넘겨주는 카메라 연결 화면용 props
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
  // 새 카메라를 추가할 때 입력값을 임시로 저장
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')

  // 현재 선택된 카메라를 목록에서 찾음
  const selected = cameras.find((c) => c.id === selectedId)

  // 이름과 위치가 모두 들어오면 부모로 전달하고 입력값 초기화
  const handleAdd = () => {
    if (!name.trim() || !location.trim()) return

    onAddCamera({
      name: name.trim(),
      location: location.trim(),
    })

    setName('')
    setLocation('')
  }

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
            {/* 연결 완료 후 스트림 주소가 있으면 영상 화면을 보여줌 */}
            {connected && streamUrl ? (
              <video
                  className="camera-preview-video"
                  src={streamUrl}
                  autoPlay
                  muted
                  playsInline
                  controls
              />
            ) : (
              <>
                {/* 연결 전에는 선택된 카메라 이름과 위치를 보여줌 */}
                <Camera size={44} />
                <p className="preview-title">
                    {selected ? selected.name : '카메라를 선택하세요'}
                </p>
                <p className="preview-sub">
                    {selected ? selected.location : '오른쪽 목록에서 선택'}
                </p>
              </>
            )}

            {/* 선택된 카메라가 있을 때만 연결 버튼 활성화 */}
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
          {/* 새 카메라를 이름과 위치로 등록하는 입력 영역 */}
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

          {/* 목록 상단 헤더 */}
          <div className="camera-list-head">
              <span>이름</span>
              <span>위치</span>
              <span>상태</span>
          </div>

          {/* 등록된 카메라 목록을 보여줌 */}
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