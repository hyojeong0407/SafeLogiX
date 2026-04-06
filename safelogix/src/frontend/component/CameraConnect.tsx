import { Camera, Link2, ArrowLeft } from 'lucide-react'
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
  connected?: boolean
}

function CameraConnect({
  title = '카메라 연결',
  connectLabel = '연결',
  cameras = [],
  selectedId = null,
  onSelect = () => {},
  onConnect = () => {},
  onBack = () => {},
  connected = false,
}: CameraConnectProps) {
  const selected = cameras.find((c) => c.id === selectedId)

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
            <Camera size={44} />
            <p className="preview-title">
              {selected ? selected.name : '카메라를 선택하세요'}
            </p>
            <p className="preview-sub">
              {selected ? selected.location : '오른쪽 목록에서 선택'}
            </p>

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