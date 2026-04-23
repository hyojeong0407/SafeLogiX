import os
import re
import base64
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from openai import AsyncOpenAI
from dotenv import load_dotenv

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
        return {
            "message": "로그인 성공!",
            "access_token": auth_response.session.access_token,
            "user_id": auth_response.user.id
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
    
# [기능 3] YOLOv10객체 탐지 파이프라인

@app.post("/api/alerts")
async def receive_alert(
    violation_type: str = Form(...),
    location: str = Form(...),
    file: UploadFile = File(...)
):
    # 1. 파일 읽기
    image_bytes = await file.read()
    
    # 2. Supabase Storage에 이미지 업로드 (선택)
    # file_path = f"alerts/{file.filename}"
    # supabase.storage.from_("snapshots").upload(file_path, image_bytes)
    
    # 3. Supabase DB 'alerts' 테이블에 위반 기록 저장
    # supabase.table("alerts").insert({
    #     "type": violation_type,
    #     "location": location,
    #     "image_url": "업로드된_스토리지_URL"
    # }).execute()

    return {"status": "success", "message": "경고가 시스템에 등록되었습니다."}

# [기능 4] 카메라연결

@app.post("/camera/connect")
async def connect_camera(req: CameraConnectRequest):
    # 1. 스마트폰 타입인지 확인 ([폰] 접두사 확인)
    if "[폰]" in req.name:
        # location 필드에서 괄호 안의 IP 주소 추출 예: "사무실 (192.168.0.5:8080)"
        ip_match = re.search(r'\((.*?)\)', req.location)
        
        if ip_match:
            ip_address = ip_match.group(1).strip()
            # http://가 없다면 붙여주고, 끝에 /video를 붙여 MJPEG 스트림 경로 완성
            stream_url = f"http://{ip_address}/video" if not ip_address.startswith("http") else f"{ip_address}/video"
            
            return {
                "status": "online",
                "message": "스마트폰 카메라 연결 성공",
                "stream_url": stream_url
            }
        else:
            return {"status": "error", "message": "IP 주소 형식이 잘못되었습니다."}

    # 2. 웹캠인 경우
    return {
        "status": "online",
        "message": "로컬 웹캠 연결 성공",
        "stream_url": "0"  # 프론트엔드에서 '0'이면 navigator.mediaDevices 호출
    }
