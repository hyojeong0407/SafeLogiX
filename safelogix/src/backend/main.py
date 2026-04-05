from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

# ---------------------------------------------------------
# 1. Supabase 연결 설정
# (여기에 본인의 Supabase URL과 API Key를 꼭 입력하세요!)
# ---------------------------------------------------------
SUPABASE_URL = "https://nronrfdqhtuwqhvrewmq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yb25yZmRxaHR1d3FodnJld21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDc5MDAsImV4cCI6MjA5MDkyMzkwMH0.a2rRZg6lDBNAJlfB8B7308MwHxSCIgLLY44BAVLe5M8"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

# ---------------------------------------------------------
# 4. API 엔드포인트
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