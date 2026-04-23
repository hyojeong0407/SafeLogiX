import cv2
import requests
import numpy as np
from ultralytics import YOLO

# 1. YOLOv10 모델 로드 (커스텀 학습된 가중치 파일이 있다면 경로 변경)
model = YOLO("yolov10n.pt") 

# 2. FastAPI 백엔드 엔드포인트 URL
API_URL = "http://127.0.0.1:8000/api/alerts"

# 3. 위험 구역 (다각형 좌표 설정 - 실제 CCTV 화면 비율에 맞춰 조정 필요)
DANGER_ZONE = np.array([[200, 200], [600, 200], [600, 400], [200, 400]], np.int32)

# 4. 카메라 캡처 (0은 기본 웹캠, CCTV 사용 시 RTSP 주소 입력)
cap = cv2.VideoCapture(0)

def send_alert_to_backend(image_frame, violation_type):
    """위험 감지 시 FastAPI 서버로 스냅샷 전송"""
    _, img_encoded = cv2.imencode('.jpg', image_frame)
    files = {'file': ('snapshot.jpg', img_encoded.tobytes(), 'image/jpeg')}
    data = {'violation_type': violation_type, 'location': 'Sector A'}
    
    try:
        response = requests.post(API_URL, files=files, data=data)
        print(f"[{violation_type}] 경고 전송 완료:", response.status_code)
    except Exception as e:
        print("서버 전송 실패:", e)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # YOLO 모델로 객체 탐지
    results = model(frame, stream=True, verbose=False)

    for result in results:
        boxes = result.boxes
        for box in boxes:
            # 클래스 ID와 신뢰도(Confidence) 확인
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            
            # COCO 데이터셋 기준: 0은 '사람(person)'
            if cls_id == 0 and conf > 0.5:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                # 객체 하단 중앙 좌표 (발 위치 추정)
                bottom_center = (int((x1 + x2) / 2), y2)
                
                # OpenCV로 사람 박스 그리기
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.circle(frame, bottom_center, 5, (0, 0, 255), -1)

                # 위험 구역 침입 여부 확인 (cv2.pointPolygonTest 사용)
                inside_zone = cv2.pointPolygonTest(DANGER_ZONE, bottom_center, False)
                
                if inside_zone >= 0:
                    cv2.putText(frame, "WARNING: INTRUSION", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    
                    # 캡처 및 서버 전송 (실제 적용 시 연속 전송 방지를 위해 쿨다운 타이머 구현 필요)
                    send_alert_to_backend(frame, "위험구역 침입")

    # 화면에 위험 구역 그리기
    cv2.polylines(frame, [DANGER_ZONE], isClosed=True, color=(0, 0, 255), thickness=2)

    # 결과 화면 출력 (테스트용)
    cv2.imshow("SafeLogiX AI Monitoring", frame)

    # 'q' 키를 누르면 종료
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()