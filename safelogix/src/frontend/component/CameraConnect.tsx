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
    
    // 💡 추가된 상태: 카메라 타입 및 IP 주소
    const [cameraType, setCameraType] = useState<'webcam' | 'smartphone'>('webcam')
    const [ipAddress, setIpAddress] = useState('')

    const videoRef = useRef<HTMLVideoElement>(null)
    const selected = cameras.find((c) => c.id === selectedId)

    // 카메라 추가 핸들러
    const handleAdd = () => {
        if (!name.trim() || !location.trim()) {
            alert('이름과 위치를 모두 입력해주세요.');
            return;
        }

        // 💡 스마트폰 선택 시 IP 주소 유효성 검사
        if (cameraType === 'smartphone' && !ipAddress.trim()) {
            alert('스마트폰 IP 주소를 입력해주세요. (예: 192.168.0.5:8080)');
            return;
        }

        // 부모 컴포넌트로 전달 (스마트폰이면 이름 앞에 [폰] 추가 및 위치 정보와 결합 가능)
        // 실제 운영 시에는 onAddCamera 인터페이스에 ipAddress 필드를 추가하는 것이 좋습니다.
        onAddCamera({ 
            name: cameraType === 'smartphone' ? `[폰] ${name.trim()}` : name.trim(),
            location: cameraType === 'smartphone' ? `${location.trim()} (${ipAddress.trim()})` : location.trim()
        })

        // 입력창 초기화
        setName('')
        setLocation('')
        setIpAddress('')
    }

    // 카메라 연결 로직 (useEffect)
    useEffect(() => {
        if (connected) {
            // 1. 스마트폰 스트리밍 (http 주소인 경우) - img 태그가 담당하므로 videoRef 처리 불필요
            if (streamUrl && streamUrl.startsWith('http')) {
                if (videoRef.current) {
                    videoRef.current.srcObject = null; // 기존 웹캠 스트림 제거
                }
            } 
            // 2. 로컬 웹캠 스트리밍 (streamUrl이 '0'이거나 비어있는 경우)
            else if (videoRef.current) {
                navigator.mediaDevices
                    .getUserMedia({ video: true })
                    .then((stream) => {
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                        }
                    })
                    .catch((error) => {
                        console.error('카메라 접근 에러:', error);
                        alert('카메라 접근 권한을 허용해주세요!');
                    });
            }
        }

        // 컴포넌트 언마운트 또는 연결 해제 시 스트림 정지
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
            }
        }
    }, [connected, streamUrl]);

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
                {/* 왼쪽: 프리뷰 영역 */}
                <div className="camera-preview">
                    <div className="camera-preview-center">
                        {connected ? (
                            // 💡 조건부 렌더링: 스마트폰(http)은 img, 웹캠은 video
                            streamUrl && streamUrl.startsWith('http') ? (
                                <img
                                    src={streamUrl}
                                    alt="Smartphone Stream"
                                    className="camera-preview-video"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={() => alert("스트리밍 연결에 실패했습니다. IP 주소를 확인하세요.")}
                                />
                            ) : (
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

                {/* 오른쪽: 목록 및 등록 영역 */}
                <div className="camera-list-wrap">
                    <div className="camera-add-form">
                        {/* 💡 카메라 타입 선택 라디오 버튼 */}
                        <div className="camera-type-selector" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="type" 
                                    checked={cameraType === 'webcam'} 
                                    onChange={() => setCameraType('webcam')} 
                                /> 웹캠
                            </label>
                            <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input 
                                    type="radio" 
                                    name="type" 
                                    checked={cameraType === 'smartphone'} 
                                    onChange={() => setCameraType('smartphone')} 
                                /> 스마트폰
                            </label>
                        </div>

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
                            placeholder="설치 위치"
                        />

                        {/* 💡 스마트폰 선택 시에만 IP 입력창 노출 */}
                        {cameraType === 'smartphone' && (
                            <input
                                type="text"
                                value={ipAddress}
                                onChange={(e) => setIpAddress(e.target.value)}
                                placeholder="IP 주소 (예: 192.168.0.5:8080)"
                                style={{ border: '1px solid #3b82f6', backgroundColor: '#eff6ff' }}
                            />
                        )}

                        <button type="button" onClick={handleAdd} className="add-btn">
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