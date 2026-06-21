import os
os.environ["OPENCV_LOG_LEVEL"] = "SILENT"
import re
import base64
import json
import io
import pandas as pd
import uuid
import cv2
import numpy as np
import asyncio
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client, Client
from openai import AsyncOpenAI
from dotenv import load_dotenv
from datetime import datetime
from ultralytics import YOLO
from weasyprint import HTML

# ---------------------------------------------------------
# 1. 환경 변수 로드 및 Supabase 연결 설정
# ---------------------------------------------------------

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

app = FastAPI()

# --- [추가] 실시간 감지 상태 관리 및 중복 방지 설정 ---
active_streams = {}        # 현재 작동 중인 카메라 태스크 관리 {camera_id: bool}
last_detection_times = {}  # 마지막 감지 시간 저장 {camera_id: datetime}
DETECTION_COOLDOWN = 60    # 중복 감지 방지 쿨타임 (60초)

# --- [추가] 백그라운드 실시간 분석 엔진 ---
async def start_realtime_monitoring(camera_id: int, company_id: str, stream_url: str):
    """카메라 스트림을 실시간으로 읽고 위험 시에만 저장하는 루프"""
    print(f"🚀 [CCTV-{camera_id}] 감시 프로세스 시작")
    
    cap_source = 0 if stream_url == "0" else stream_url
    cap = cv2.VideoCapture(cap_source)
    
    # 성능 최적화: 프레임 건너뛰기용 카운터
    frame_count = 0

    try:
        while camera_id in active_streams and active_streams[camera_id]:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(5)
                cap.open(cap_source)
                continue

            frame_count += 1
            if frame_count % 3 != 0: # 3프레임당 1번만 분석 (CPU 부하 감소)
                await asyncio.sleep(0.01)
                continue

            # 1. YOLO 분석 (imgsz를 줄여 속도 향상)
            results = yolo_model.predict(frame, conf=0.15, imgsz=320, verbose=False)
            
            persons = []
            helmets = []
            is_violation = False

            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    coords = box.xyxy[0].cpu().numpy().astype(int)
                    if cls == 6: persons.append(coords)
                    elif cls == 0: helmets.append(coords)
                    elif cls == 7: is_violation = True # 직접 감지 클래스

            # 2. 역발상 판단 (사람 안에 헬멧이 없는가?)
            violation_targets = []
            if not is_violation: # 직접 감지 안됐을 때만 체크
                for p in persons:
                    px1, py1, px2, py2 = p
                    if not any(not (hx2 < px1 or hx1 > px2 or hy2 < py1 or hy1 > py2) for hx1, hy1, hx2, hy2 in helmets):
                        is_violation = True
                        violation_targets.append(p)

            # 3. 위반 감지 시 쿨타임 체크 후 저장
            if is_violation:
                now = datetime.now()
                last_time = last_detection_times.get(camera_id)

                if last_time is None or (now - last_time).total_seconds() > DETECTION_COOLDOWN:
                    last_detection_times[camera_id] = now
                    
                    # 캡처 및 시각화
                    for v in violation_targets:
                        cv2.rectangle(frame, (v[0], v[1]), (v[2], v[3]), (0, 0, 255), 3)
                    
                    filename = f"realtime_{camera_id}_{now.strftime('%H%M%S')}.jpg"
                    if not os.path.exists('temp'): os.makedirs('temp')
                    save_path = f"temp/{filename}"
                    cv2.imwrite(save_path, frame)

                    # Supabase 업로드 및 DB 기록
                    try:
                        with open(save_path, 'rb') as f:
                            supabase.storage.from_("snapshots").upload(filename, f)
                        url = supabase.storage.from_("snapshots").get_public_url(filename)
                        
                        supabase.table("safety_logs").insert({
                            "company_id": company_id,
                            "camera_id": camera_id,
                            "violation_type": "안전모 미착용",
                            "snapshot_url": url,
                            "detected_at": now.isoformat()
                        }).execute()
                        print(f"🚨 [CCTV-{camera_id}] 위반 저장 완료: {url}")
                    except Exception as e:
                        print(f"DB 저장 실패: {e}")

            await asyncio.sleep(0.01) # 컨텍스트 스위칭 허용

    finally:
        cap.release()
        print(f"🛑 [CCTV-{camera_id}] 감시 종료")

# 모델 로드-------------------------------------------------
try:
    # 학습된 모델이 있다면 "best.pt"로 변경, 없으면 기본 "yolov10n.pt" 다운로드
    yolo_model = YOLO("best.pt") 
    print("✅ 학습된 최신 모델(best.pt) 로드 완료")

except Exception as e:
    print(f"❌ 모델 로드 실패: {e}")

# ---------------------------------------------------------
# 2. CORS 설정 (프론트엔드 localhost:5173 허용)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 테스트 단계에서는 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 3. 데이터 모델 정의
# ---------------------------------------------------------
class LoginRequest(BaseModel):
    access_code: str

class CreateCodeRequest(BaseModel):
    access_code: str
    company_id: str
    role: str = "USER"

class CameraConnectRequest(BaseModel):
    camera_id: str
    name: str
    location: str
    company_id: str  

class LogisticsSaveRequest(BaseModel):
    company_id: str  # ERD의 uuid 타입 (어떤 회사의 데이터인지 필요)
    vendorName: str  # 업체명 (logistics_documents의 vendor_name)
    itemName: str    # 품목명 (inventory_logs의 item_name)
    quantity: int    # 수량 (inventory_logs의 quantity)
    type: str = "IN" # 구분 (ERD의 inventory_logs.type 컬럼용: 기본값 '입고')

class UpdateLogRequest(BaseModel):
    status: str
    admin_memo: str = "" 

# ---------------------------------------------------------
# 4. 유틸리티 함수: 이미지 Base64 인코딩
# ---------------------------------------------------------
async def encode_image(file: UploadFile):
    contents = await file.read()
    return base64.b64encode(contents).decode("utf-8")
# ---------------------------------------------------------
# 5. API앤드 포인트
# ---------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "running", "message": "Safelogix Backend"}

# [기능 1] 작업자 로그인 API
@app.post("/login")
def login_with_code(req: LoginRequest):
    # 공백 제거 및 소문자 변환으로 에러 방지
    safe_code = req.access_code.strip().lower()
    virtual_email = f"{safe_code}@safelogix.com"
    virtual_password = safe_code

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": virtual_email,
            "password": virtual_password
        })
        current_user_id = auth_response.user.id
        user_db_info = supabase.table("users").select("company_id").eq("id", current_user_id).execute()
        real_company_id = user_db_info.data[0]["company_id"] if user_db_info.data else None
        return {
            "message": "로그인 성공!",
            "access_token": auth_response.session.access_token,
            "user_id": auth_response.user.id,
            "company_id": real_company_id
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="유효하지 않은 접속 코드입니다.")
        
# [기능 2] 관리자용 접속 코드 발급 API
@app.post("/admin/generate-code")
def generate_access_code(req: CreateCodeRequest):
    safe_code = req.access_code.strip().lower()
    virtual_email = f"{safe_code}@safelogix.com"
    virtual_password = safe_code

    try:
        # 1. Supabase Auth 계정 생성
        auth_response = supabase.auth.sign_up({
            "email": virtual_email,
            "password": virtual_password
        })
        new_user_id = auth_response.user.id
        
        # 2. 'users' 테이블에 추가 정보 저장
        supabase.table("users").insert({
            "id": new_user_id,
            "company_id": req.company_id,
            "email": virtual_email,
            "role": req.role
        }).execute()
        
        return {
            "message": "접속 코드가 성공적으로 발급되었습니다.",
            "access_code": safe_code,
            "user_id": new_user_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"코드 발급 실패: {str(e)}")
    
# [기능 3] YOLOv10 객체 탐지 및 안전모 미착용 집중 분석 파이프라인
@app.post("/api/analyze-image")
async def analyze_uploaded_image(
    company_id: str = Form(...),
    camera_id: int = Form(1), 
    file: UploadFile = File(...)
):
    try:
        # 1. 파일 읽기 및 변환
        image_bytes = await file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 2. YOLOv10 분석 실행 (사람과 헬멧을 확실히 잡기 위해 conf 조절)
        results = yolo_model.predict(frame, conf=0.25, verbose=False)
        
        persons = []    # 사람 좌표
        helmets = []    # 안전모 좌표
        detections = [] # 로그용 전체 감지 결과
        is_violation = False
        
        annotated_frame = frame.copy()

        # 3. 1차 스캔: 모든 사람(6)과 안전모(0), 직접 미착용(7) 식별
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = yolo_model.names[cls_id]
                coords = box.xyxy[0].cpu().numpy().astype(int)

                detections.append({"label": label, "confidence": conf, "cls_id": cls_id})

                if cls_id == 6: # Person
                    persons.append(coords)
                elif cls_id == 0: # Helmet
                    helmets.append(coords)
                elif cls_id == 7: # 직접 감지된 no_helmet
                    is_violation = True
                    # 직접 감지된 미착용자 표시
                    cv2.rectangle(annotated_frame, (coords[0], coords[1]), (coords[2], coords[3]), (0, 0, 255), 3)
                    cv2.putText(annotated_frame, "No Helmet", (coords[0], coords[1]-10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        # 4. 2차 스캔: 역발상 로직 (사람 박스 안에 헬멧이 없는 경우)
        for p_box in persons:
            px1, py1, px2, py2 = p_box
            has_helmet = False
            
            for h_box in helmets:
                hx1, hy1, hx2, hy2 = h_box
                # 헬멧 박스가 사람 박스 가로 폭 안에 있고, 사람의 상단 영역에 걸쳐있는지 확인
                # (단순 겹침 판단)
                if not (hx2 < px1 or hx1 > px2 or hy2 < py1 or hy1 > py2):
                    has_helmet = True
                    break
            
            if not has_helmet:
                is_violation = True
                # 안전모 미착용자로 판단된 사람(Person) 박스 표시
                cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 0, 255), 3)
                cv2.putText(annotated_frame, "No Helmet Detected", (px1, py1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        # 5. 위반 발생 시 처리
        if is_violation:
            current_time = datetime.now()
            if not os.path.exists('temp'): os.makedirs('temp')
            
            filename = f"helmet_violation_{current_time.strftime('%Y%m%d_%H%M%S')}.jpg"
            save_path = f"temp/{filename}"
            cv2.imwrite(save_path, annotated_frame)

            # Supabase Storage 업로드
            with open(save_path, 'rb') as f:
                supabase.storage.from_("snapshots").upload(filename, f)
            
            snapshot_url = supabase.storage.from_("snapshots").get_public_url(filename)

            # Supabase DB 저장 (safety_logs)
            supabase.table("safety_logs").insert({
                "company_id": company_id,
                "camera_id": int(camera_id),
                "violation_type": "안전모 미착용",
                "snapshot_url": snapshot_url,
                "detected_at": current_time.isoformat()
            }).execute()

            return {
                "status": "violation", 
                "message": "경고: 안전모 미착용 작업자가 감지되었습니다.", 
                "detections": detections, 
                "image_url": snapshot_url
            }

        # 6. 위반 없음
        return {
            "status": "safe", 
            "message": "모든 작업자가 안전모를 착용 중입니다.", 
            "detections": detections
        }

    except Exception as e:
        print(f"이미지 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")

# [기능 4] 카메라연결

@app.post("/camera/connect")
async def connect_camera(req: CameraConnectRequest): 
    
    company_id = req.company_id
    # 1. 스트림 URL 판단
    stream_url = "0"
    if "[폰]" in req.name:
        ip_match = re.search(r'\((.*?)\)', req.location)
        if ip_match:
            ip_address = ip_match.group(1).strip()
            stream_url = f"http://{ip_address}/video" if not ip_address.startswith("http") else f"{ip_address}/video"

    cam_id_key = int(req.camera_id)
    company_id = req.company_id

# --- [추가] DB에 카메라 정보 등록 (UPSERT 로직) ---
    try:
        # cameras 테이블에 이 카메라 ID가 있는지 확인하고, 없으면 생성/있으면 수정합니다.
        supabase.table("cameras").upsert({
            "id": cam_id_key,
            "company_id": company_id, # UUID 형식 그대로 들어감
            "location_name": req.location,
            "is_active": True,
            "stream_url": stream_url
        }).execute()
        print(f"✅ [DB] 카메라 {cam_id_key} 정보 등록/업데이트 완료")
    except Exception as e:
        print(f"❌ [DB] 카메라 등록 실패: {e}")
        # 카메라 등록에 실패하면 외래키 제약조건 때문에 로그 저장이 안 되므로 에러를 던지는 것이 좋습니다.
        raise HTTPException(status_code=500, detail="카메라를 DB에 등록할 수 없습니다.")
    # ----------------------------------------------

    # 2. 기존 실행 중인 동일 카메라가 있다면 중지
    if cam_id_key in active_streams:
        active_streams[cam_id_key] = False
        await asyncio.sleep(0.5) # 종료 대기

    # 3. 백그라운드 태스크로 분석 시작
    active_streams[cam_id_key] = True
    asyncio.create_task(start_realtime_monitoring(cam_id_key, company_id, stream_url))
    
    return {
        "status": "online",
        "message": f"카메라 {cam_id_key} 실시간 감시 모드가 시작되었습니다.",
        "stream_url": stream_url
    }

# [기능 5] 문서 사진 AI 스캔 및 추출 (다중 품목 + 구분 추가)
@app.post("/scan-document")
async def scan_document(file: UploadFile = File(...)):
    try:
        encoded_image = await encode_image(file)
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    # 💡 변경: 'type' 키를 추가하고 입고/출고 값을 추출하라고 지시
                    "content": "You are an expert at extracting information from logistics documents. Extract ALL items from the document. Output strictly as a JSON object containing an 'items' array. Each object in the array must have keys: 'company_name', 'item_name', 'quantity', and 'type'. For 'type', determine if it is receiving (입고) or issuing (출고)."
                },
                {
                    "role": "user",
                    "content": [
                        # 💡 변경: 유저 프롬프트에도 구분(입고/출고)을 명시
                        {"type": "text", "text": "이 이미지에서 업체명, 품목명, 수량, 구분(입고 또는 출고)을 모두 찾아서 배열 형태로 추출해줘. 수량은 숫자만."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_image}"}}
                    ],
                }
            ],
            response_format={ "type": "json_object" }
        )
        
        result_json = json.loads(response.choices[0].message.content)
        items = result_json.get("items", [])
        
        formatted_items = []
        for item in items:
            formatted_items.append({
                "company_name": item.get("company_name", ""),
                "item_name": item.get("item_name", ""),
                "quantity": str(item.get("quantity", "0")),
                "type": item.get("type", "입고") # 💡 구분 값 추출 (없으면 기본값 '입고')
            })
            
        return {"items": formatted_items}
    except Exception as e:
        print(f"OCR Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 인식 오류: {str(e)}")

# [기능 6] 문서 파일 업로드 및 파싱 (다중 품목 + 구분 추가)
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")
        
        if df.empty:
            raise HTTPException(status_code=400, detail="파일이 비어있습니다.")

        # 1. 엑셀 데이터를 AI가 읽기 좋은 텍스트(JSON/Dict)로 변환
        raw_data = df.fillna("").to_dict(orient="records")

        # 2. AI에게 데이터 매핑 요청
        # 데이터가 너무 많을 경우를 대비해 상위 일정량만 보내거나 조절 가능합니다.
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
                    당신은 물류 데이터 전문가입니다. 
                    제공된 원본 데이터(List of Dict)를 분석하여 우리 시스템 규격에 맞게 변환하세요.
                    
                    변환 규칙:
                    1. 결과는 반드시 'items'라는 키를 가진 JSON 객체여야 합니다.
                    2. 각 항목은 다음 키를 가져야 합니다:
                       - 'company_name': 업체명, 상호, 공급처 등과 관련된 값
                       - 'item_name': 품목, 상품명, 모델명 등과 관련된 값
                       - 'quantity': 수량, 개수 등 (숫자만 남길 것)
                       - 'type': '입고' 또는 '출고' (데이터에 명시되지 않았다면 문맥상 판단하거나 기본값 '입고')
                    3. 원본 데이터의 컬럼명이 무엇이든 문맥을 파악해서 위 키값으로 매핑하세요.
                    """
                },
                {
                    "role": "user",
                    "content": f"이 데이터를 규격에 맞춰 변환해줘: {json.dumps(raw_data, ensure_ascii=False)}"
                }
            ],
            response_format={ "type": "json_object" }
        )

        # 3. AI 응답 파싱
        result_json = json.loads(response.choices[0].message.content)
        parsed_items = result_json.get("items", [])

        # 4. 최종 데이터 보정 (안전장치)
        formatted_items = []
        for item in parsed_items:
            formatted_items.append({
                "company_name": str(item.get("company_name", "")),
                "item_name": str(item.get("item_name", "")),
                "quantity": str(item.get("quantity", "0")),
                "type": item.get("type", "입고")
            })

        return {"items": formatted_items}

    except Exception as e:
        print(f"AI Excel Parsing Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 문서 해석 실패: {str(e)}")

# [기능 7] 최종 검수 데이터 저장 (구분 값 동적 저장)
@app.post("/save-logistics")
async def save_logistics(
    company_id: str = Form(...),
    vendorName: str = Form(...),
    itemName: str = Form(...),
    type: str = Form(...),
    quantity: int = Form(...),
    file: UploadFile = File(None)
):
    try:
        image_url = None

        if file:
            file_extension = file.filename.split(".")[-1] if "." in file.filename else "png"
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_bytes = await file.read()
            supabase.storage.from_("documents").upload(
                path=unique_filename,
                file=file_bytes,
                file_options={"content-type": file.content_type}
            )
            image_url = supabase.storage.from_("documents").get_public_url(unique_filename)

        doc_res = supabase.table("logistics_documents").insert({
            "company_id": company_id,
            "vendor_name": vendorName,
            "document_date": "now()",
            "raw_image_url": image_url
        }).execute()
        
        if not doc_res.data:
            raise Exception("Document insert failed")
        
        new_doc_id = doc_res.data[0]['id']

        log_res = supabase.table("inventory_logs").insert({
            "company_id": company_id,
            "document_id": new_doc_id,
            "item_name": itemName,
            "type": type,
            "quantity": quantity, 
            "unit": "EA"
        }).execute()

        return {"status": "success", "image_url": image_url}
    
    except Exception as e:
        print(f"Error detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DB 저장 오류: {str(e)}")

# [기능 8] 회사 데이터 가져오기 (수정본)
@app.get("/logistics-list")
def get_logistics_list(company_id: str):
    try:
        # 1. inventory_logs 테이블에서 필요한 컬럼들을 선택
        # 2. .select("..., logistics_documents(vendor_name)") 문법으로 조인 수행
        # 3. 정렬 기준을 실제 DB 컬럼인 'logged_at'으로 변경
        response = supabase.table("inventory_logs") \
            .select("""
                id,
                logged_at,
                item_name,
                type,
                quantity,
                logistics_documents (
                    vendor_name
                )
            """) \
            .eq("company_id", company_id) \
            .order("logged_at", desc=True) \
            .execute()
        
        return {"items": response.data}

    except Exception as e:
        # 구체적인 에러 확인을 위해 서버 터미널에 에러 로그 출력
        print(f"불러오기 에러 상세: {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 불러오기 실패: {str(e)}")
    
# [기능 9] 데이터 기간으로 필터링해 엑셀파일 변환
@app.get("/download-logistics")
async def download_logistics(
    start_date: str, 
    end_date: str, 
    company_id: str, # 💡 프론트엔드에서 넘겨받아야 함
    format: str = "excel"
):
    try:
        # 1. DB에서 날짜 범위 및 회사 ID에 해당하는 데이터 실제 조회
        # .gte(크거나 같음), .lte(작거나 같음) 필터 사용
        response = supabase.table("inventory_logs") \
            .select("""
                logged_at,
                item_name,
                type,
                quantity,
                logistics_documents (
                    vendor_name
                )
            """) \
            .eq("company_id", company_id) \
            .gte("logged_at", f"{start_date} 00:00:00") \
            .lte("logged_at", f"{end_date} 23:59:59") \
            .order("logged_at", desc=False) \
            .execute()

        # 2. 데이터 유무 확인
        if not response.data:
             # 데이터가 없을 경우 404 혹은 빈 엑셀을 내려줄 수 있음
             raise HTTPException(status_code=404, detail="선택한 기간에 해당하는 데이터가 없습니다.")

        # 3. 엑셀/CSV용 데이터 가공 (평면화)
        processed_data = []
        for row in response.data:
            processed_data.append({
                "날짜": row['logged_at'][:10] if row['logged_at'] else "-",
                "품목명": row['item_name'],
                "구분": "출고" if row['type'] == "OUT" else "입고",
                "수량": row['quantity'],
                "업체명": row.get('logistics_documents', {}).get('vendor_name', '-') if row.get('logistics_documents') else "-"
            })
        
        # 4. Pandas DataFrame 변환
        df = pd.DataFrame(processed_data)
        
        if format == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Logistics_Report')
            output.seek(0)
            
            headers = {'Content-Disposition': f'attachment; filename="logistics_{start_date}_{end_date}.xlsx"'}
            return StreamingResponse(
                output, 
                headers=headers, 
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        
        else: # CSV 처리
            stream = io.StringIO()
            df.to_csv(stream, index=False, encoding='utf-8-sig') # 엑셀 한글 깨짐 방지 위해 utf-8-sig 사용
            return StreamingResponse(
                iter([stream.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=logistics_{start_date}_{end_date}.csv"}
            )

    except Exception as e:
        print(f"Download Error: {str(e)}") # 서버 로그 확인용
        raise HTTPException(status_code=500, detail=f"파일 생성 실패: {str(e)}")
    
# [기능 10] AI 위험 감지 로그 리스트 불러오기
@app.get("/api/safety-logs")
def get_safety_logs(company_id: str):
    try:
        # safety_logs와 cameras 테이블 조인 (카메라 위치 획득)
        response = supabase.table("safety_logs") \
            .select("""
                id,
                detected_at,
                camera_id,
                violation_type,
                status,
                snapshot_url,
                cameras ( location_name )
            """) \
            .eq("company_id", company_id) \
            .order("detected_at", desc=True) \
            .execute()
        
        return {"logs": response.data}
    except Exception as e:
        print(f"로그 불러오기 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 불러오기 실패: {str(e)}")
    
# [기능 11] AI 위험 감지 로그 상태 업데이트
@app.patch("/api/safety-logs/{log_id}")
async def update_safety_log(log_id: int, req: UpdateLogRequest):
    try:
        # DB의 status 컬럼 업데이트
        response = supabase.table("safety_logs").update({
            "status": req.status,
            "admin_memo": req.admin_memo 
        }).eq("id", log_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="해당 로그를 찾을 수 없습니다.")

        return {"message": "상태가 성공적으로 업데이트되었습니다.", "data": response.data}
    
    except Exception as e:
        print(f"상태 업데이트 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업데이트 실패: {str(e)}")

# [기능 12] AI 안전 보고서 생성 및 다운로드 API (PDF 생성 및 데이터 심층 분석)
@app.get("/api/download-safety-report")
async def download_safety_report(company_id: str, start_date: str = None, end_date: str = None):
    try:
        # 1. Supabase에서 안전 로그 데이터 및 카메라 위치 가져오기
        query = supabase.table("safety_logs").select("""
            id,
            detected_at,
            violation_type,
            status,
            admin_memo,
            snapshot_url,
            cameras ( location_name )
        """).eq("company_id", company_id)
        
        if start_date:
            query = query.gte("detected_at", f"{start_date} 00:00:00")
        if end_date:
            query = query.lte("detected_at", f"{end_date} 23:59:59")
            
        response = query.order("detected_at", desc=True).execute()
        logs = response.data if response.data else []
        
        if not logs:
            raise HTTPException(status_code=404, detail="보고서를 생성할 안전 로그 데이터가 없습니다.")
        
        # 기본 요약 통계 계산
        total_count = len(logs)
        confirmed_count = sum(1 for l in logs if l.get("status") in ["경고 확정", "경고확정"])
        unchecked_count = sum(1 for l in logs if l.get("status") in ["UNCHECKED", "미확인"])
        resolved_count = total_count - unchecked_count
        
        # 2. OpenAI 가공용 로그 요약문 작성 (최근 15개 중심 심층 요약)
        log_summary_text = ""
        for log in logs[:15]:
            loc = log.get("cameras", {}).get("location_name", "미확인") if log.get("cameras") else "미확인"
            log_summary_text += f"- 로그번호: {log['id']}, 시간: {log['detected_at']}, 위치: {loc}, 종류: {log['violation_type']}, 상태: {log['status']}, 조치메모: {log['admin_memo'] or '없음'}\n"
        
        # 3. OpenAI GPT-4o-mini 에 안전 종합 총평 및 분석 요청
        prompt = f"""
        당신은 산업 현장의 인공지능 안전 분석관(AI Safety Officer)입니다.
        최근 물류창고 내부에서 감지된 '안전 위반(안전모 미착용 등)' 로그 통계와 내역 데이터를 기반으로, 종합 안전 분석 보고서 본문을 작성해 주세요.
        
        [종합 데이터 통계]
        - 전체 감지 건수: {total_count}건
        - 관리자 경고 확정 건수: {confirmed_count}건
        - 미확인 대기 건수: {unchecked_count}건
        
        [최근 발생한 주요 위반 사례 정보]
        {log_summary_text}
        
        [보고서 작성 필수 규칙]
        1. 반드시 전문적이고 객관적인 비즈니스 톤앤매너의 한국어로 작성하세요.
        2. HTML 구조 태그(예: <h3>, <p>, <ul>, <li>, <strong>)만을 활용해서 세련된 텍스트 서식을 만드세요. 코드 블록(```html)은 절대 포함하지 말고 순수 태그 텍스트 내용만 출력하세요.
        3. 하위 3개 세션을 명확히 구분하여 심도 깊은 분석을 제공하세요:
           - 1) 현장 안전 보건 관리 총평 (현재 위험 징후 및 검수율에 대한 평가)
           - 2) 위험 요소 분석 및 취약 구역 패턴 파악 (사사로운 발생 구역 정보 종합 분석)
           - 3) 현장 안전 강화를 위한 긴급 대응 및 예방 대책 제안
        """
        
        ai_response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "산업 안전 진단 전문가로서 고품질 보고서 내용을 구조화된 HTML 서식으로 작성하는 역할입니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        ai_analysis_html = ai_response.choices[0].message.content
        ai_analysis_html = ai_analysis_html.replace("```html", "").replace("```", "").strip()
        
        # 4. 전체 HTML 템플릿 + WeasyPrint 전용 CSS 스타일링
        log_rows_html = ""
        for log in logs:
            loc = log.get("cameras", {}).get("location_name", "미확인") if log.get("cameras") else "미확인"
            img_src = log.get("snapshot_url", "")
            img_html = f'<img src="{img_src}" class="report-img" />' if img_src else '<span style="color:#aaa;">이미지 없음</span>'
            date_str = log['detected_at'][:19].replace("T", " ")
            memo_str = log.get("admin_memo") or "-"
            
            log_rows_html += f"""
            <tr>
                <td style="text-align: center; font-weight: bold;">{log['id']}</td>
                <td style="text-align: center; white-space: nowrap;">{date_str}</td>
                <td>{loc}</td>
                <td style="text-align: center;"><span class="badge badge-danger">{log['violation_type']}</span></td>
                <td style="text-align: center; font-weight: bold; color: {'#ef4444' if log['status'] in ['경고 확정', '경고확정'] else '#64748b'};">{log['status']}</td>
                <td>{memo_str}</td>
                <td style="text-align: center;">{img_html}</td>
            </tr>
            """
            
        current_report_time = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        html_report_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>SafeLogiX AI Safety Report</title>
            <style>
                @page {{
                    size: A4;
                    margin: 20mm 15mm 20mm 15mm;
                    @bottom-right {{
                        content: counter(page) " / " counter(pages);
                        font-size: 9pt;
                        color: #94a3b8;
                    }}
                    @bottom-left {{
                        content: "SafeLogiX AI 자동화 시스템 안전 진단 보고서";
                        font-size: 9pt;
                        color: #94a3b8;
                    }}
                }}
                body {{
                    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
                    color: #1e293b;
                    line-height: 1.6;
                    font-size: 10pt;
                    margin: 0;
                    padding: 0;
                }}
                .header-container {{
                    border-bottom: 3px solid #0f172a;
                    padding-bottom: 12px;
                    margin-bottom: 30px;
                }}
                .header-container h1 {{
                    font-size: 26pt;
                    color: #0f172a;
                    margin: 0 0 8px 0;
                    font-weight: 800;
                    letter-spacing: -1px;
                }}
                .header-container .meta-info {{
                    font-size: 10pt;
                    color: #64748b;
                    text-align: right;
                }}
                .section-header {{
                    font-size: 14pt;
                    color: #0f172a;
                    border-left: 5px solid #ef4444;
                    padding-left: 10px;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    font-weight: bold;
                }}
                .summary-box-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }}
                .summary-box-table th, .summary-box-table td {{
                    border: 1px solid #cbd5e1;
                    padding: 12px;
                    text-align: center;
                }}
                .summary-box-table th {{
                    background-color: #f8fafc;
                    color: #475569;
                    font-weight: bold;
                }}
                .ai-generated-content {{
                    background-color: #fafafa;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 30px;
                }}
                .ai-generated-content h3 {{
                    font-size: 12pt;
                    color: #1e293b;
                    margin-top: 15px;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 6px;
                }}
                .ai-generated-content ul, .ai-generated-content ol {{
                    margin-top: 5px;
                    padding-left: 20px;
                }}
                .ai-generated-content li {{
                    margin-bottom: 4px;
                }}
                .main-log-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 9pt;
                }}
                .main-log-table th {{
                    background-color: #0f172a;
                    color: #ffffff;
                    font-weight: bold;
                    text-align: center;
                    padding: 10px 8px;
                    border: 1px solid #0f172a;
                }}
                .main-log-table td {{
                    border: 1px solid #e2e8f0;
                    padding: 8px 8px;
                    vertical-align: middle;
                }}
                .main-log-table tr:nth-child(even) {{
                    background-color: #f8fafc;
                }}
                .report-img {{
                    max-width: 110px;
                    max-height: 75px;
                    border-radius: 4px;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }}
                .badge {{
                    display: inline-block;
                    padding: 3px 7px;
                    font-size: 8pt;
                    font-weight: bold;
                    border-radius: 4px;
                    color: #ffffff;
                }}
                .badge-danger {{
                    background-color: #ef4444;
                }}
            </style>
        </head>
        <body>
            <div class="header-container">
                <h1>AI 자율형 안전보건 진단 보고서</h1>
                <div class="meta-info">출력일시: {current_report_time} | 사업장(회사) 식별코드: {company_id}</div>
            </div>

            <div class="section-header">1. 실시간 모니터링 안전 위반 요약 통계</div>
            <table class="summary-box-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">총 위험 감지 건수</th>
                        <th style="width: 25%;">관리자 확정 건수</th>
                        <th style="width: 25%;">미확인 대기 건수</th>
                        <th style="width: 25%;">안전 검수 조치율</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-size: 15pt; font-weight: bold; color: #ef4444;">{total_count} 건</td>
                        <td style="font-size: 13pt; font-weight: bold; color: #2563eb;">{confirmed_count} 건</td>
                        <td style="font-size: 13pt; font-weight: bold; color: #64748b;">{unchecked_count} 건</td>
                        <td style="font-size: 15pt; font-weight: bold; color: #16a34a;">
                            {f"{(resolved_count / total_count * 100):.1f}%" if total_count > 0 else "0.0%"}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="section-header">2. AI 종합 심층 분석 리포트 (gpt-4o-mini)</div>
            <div class="ai-generated-content">
                {ai_analysis_html}
            </div>

            <div style="page-break-before: always;"></div>

            <div class="section-header">3. 전체 안전 위험 감지 및 조치 내역 (상세 로그)</div>
            <table class="main-log-table">
                <thead>
                    <tr>
                        <th style="width: 6%;">No</th>
                        <th style="width: 17%;">감지 시간</th>
                        <th style="width: 15%;">카메라 위치</th>
                        <th style="width: 15%;">위험 분류</th>
                        <th style="width: 12%;">상태</th>
                        <th style="width: 19%;">조치사항 및 메모</th>
                        <th style="width: 16%;">현장 현황 스냅샷</th>
                    </tr>
                </thead>
                <tbody>
                    {log_rows_html}
                </tbody>
            </table>
        </body>
        </html>
        """
        
        # 5. WeasyPrint를 활용한 PDF 바이트 파일 컴파일
        pdf_stream = io.BytesIO()
        HTML(string=html_report_template).write_pdf(pdf_stream)
        pdf_stream.seek(0)
        
        formatted_date = datetime.now().strftime("%Y%m%d_%H%M")
        download_filename = f"AI_Safety_Report_{formatted_date}.pdf"
        
        return StreamingResponse(
            pdf_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
        )

    except Exception as e:
        print(f"보고서 다운로드 실패 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI 안전 보고서 빌드 중 내부 오류가 발생했습니다: {str(e)}")