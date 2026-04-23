import cv2
import os
import time
import uuid  # 중복 방지를 위한 uuid 추가
from datetime import datetime
from dotenv import load_dotenv
from ultralytics import YOLO
from supabase import create_client

# .env 로드
load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

model = YOLO("yolov10n.pt") 

def process_camera(camera_id, company_id, source_url):
    cap = cv2.VideoCapture(int(source_url) if source_url == '0' else source_url)
    if not os.path.exists('temp'): os.makedirs('temp')

    print(f"📸 분석 시작...")

    while cap.isOpened():
        success, frame = cap.read()
        if not success: break

        results = model(frame, conf=0.5, verbose=False)
        
        if len(results[0].boxes) > 0:
            # 💡 해결 1: 파일명 중복 방지 (밀리초 + 랜덤 문자열 추가)
            ms_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            unique_id = str(uuid.uuid4())[:8] # 짧은 랜덤 키
            filename = f"safety_{camera_id}_{ms_timestamp}_{unique_id}.jpg"
            local_path = f"temp/{filename}"
            
            cv2.imwrite(local_path, frame)
            
            try:
                # 1. Supabase Storage 업로드
                with open(local_path, 'rb') as f:
                    supabase.storage.from_("snapshots").upload(filename, f)
                
                snapshot_url = supabase.storage.from_("snapshots").get_public_url(filename)

                # 💡 해결 2: ID 데이터 타입 맞추기
                # 만약 DB 컬럼이 bigint라면 int()로 감싸야 하고, 
                # UUID(문자열) 타입이라면 그대로 두어야 합니다.
                # 아래 예시는 에러 메시지에 맞춰 숫자로 변환을 시도하거나 실제 값을 넣는 부분입니다.
                
                insert_data = {
                    "company_id": company_id,  # 만약 에러가 계속 나면 DB에서 컬럼 타입을 확인하세요!
                    "camera_id": camera_id,
                    "violation_type": "안전 미준수",
                    "snapshot_url": snapshot_url,
                    "status": "pending",
                    "detected_at": datetime.now().isoformat()
                }

                supabase.table("safety_logs").insert(insert_data).execute()
                print(f"🚀 저장 성공: {snapshot_url}")
                
                os.remove(local_path)
                time.sleep(5) # 쿨타임

            except Exception as e:
                print(f"❌ 전송 에러: {e}")

    cap.release()

if __name__ == "__main__":
    # ERD를 보니 camera_id가 int8(숫자)입니다.
    # 1. Supabase 'cameras' 테이블에 가서 id 숫자를 확인하세요. (예: 1)
    # 2. 'companies' 테이블의 id는 uuid 타입이 맞습니다.
    
    MY_CAMERA_ID = 1  # 실제 cameras 테이블의 id 숫자 입력
    MY_COMPANY_ID = "e45e0edd-3df3-4978-984d-63ff53302981" # 실제 company uuid 입력
    
    process_camera(MY_CAMERA_ID, MY_COMPANY_ID, "0")