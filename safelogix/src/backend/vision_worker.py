import cv2
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from roboflow import Roboflow
from supabase import create_client


# 1. 초기 설정 로드
load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# 2. Roboflow 접속 (inference_client 사용)
rf = Roboflow(api_key="NBXpOGSyxX17hapZXcfX")
client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="NBXpOGSyxX17hapZXcfX"
)

def process_camera(camera_id, company_id, source_url):
    cap = cv2.VideoCapture(int(source_url) if source_url == '0' else source_url)
    if not os.path.exists('temp'): os.makedirs('temp')

    print(f"👷 통합 안전 감지 시스템 가동 중...")
    print(f"⏱️ 감지 시 20초간 대기(Cooldown) 모드가 활성화되었습니다.")

    while cap.isOpened():
        success, frame = cap.read()
        if not success: break

        # 분석용 임시 파일
        temp_img = "temp/current_frame.jpg"
        cv2.imwrite(temp_img, frame)

        try:
            # 3. AI 워크플로우 실행
            result = client.run_workflow(
                workspace_name="-itwia",
                workflow_id="general-segmentation-api-2",
                images={"image": temp_img},
                parameters={
                    "classes": "helmet, no_helmet, suit, no_suit, glove, no_glove"
                }
            )

            # 결과 노드에서 데이터 추출
            output_data = result[0] if isinstance(result, list) else result
            predictions = output_data.get('output_nodes_data', {}).get('predictions', [])
            
            violations = []
            
            # 위반 사항 체크
            for pred in predictions:
                label = pred.get('class')
                conf = pred.get('confidence', 0)
                
                if conf > 0.3:
                    if label == 'no_helmet':
                        violations.append("안전모 미착용")
                    elif label == 'no_suit':
                        violations.append("안전조끼 미착용")
                    elif label == 'no_glove':
                        violations.append("안전장갑 미착용")

            # 4. 위반 감지 시 처리 로직
            if violations:
                violation_str = ", ".join(list(set(violations)))
                print(f"⚠️ {datetime.now().strftime('%H:%M:%S')} - 위반 감지: {violation_str}")
                
                # [스냅샷 저장]
                filename = f"violation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                save_path = f"temp/{filename}"
                cv2.imwrite(save_path, frame)

                # [Supabase 업로드]
                with open(save_path, 'rb') as f:
                    supabase.storage.from_("snapshots").upload(filename, f)
                
                snapshot_url = supabase.storage.from_("snapshots").get_public_url(filename)

                # [DB 로그 기록]
                supabase.table("safety_logs").insert({
                    "company_id": company_id,
                    "camera_id": camera_id,
                    "violation_type": violation_str,
                    "snapshot_url": snapshot_url,
                    "detected_at": datetime.now().isoformat()
                }).execute()
                
                print(f"✅ 로그 저장 완료. 20초간 감지를 중단합니다...")
                
                # 🔥 [중요] 사진 폭탄 방지: 20초간 대기
                time.sleep(20) 
                print(f"🔄 감지를 재개합니다.")

        except Exception as e:
            print(f"❌ 분석 오류: {e}")
        
        # 평상시에는 1초에 한 번만 분석 (리소스 절약)
        time.sleep(1)

    cap.release()

if __name__ == "__main__":
    # 본인의 실제 ID로 테스트하세요
    process_camera(1, "e45e0edd-3df3-4978-984d-63ff53302981", "0")