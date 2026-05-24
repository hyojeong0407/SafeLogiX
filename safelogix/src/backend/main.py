import os
import re
import base64
import json
import io
import pandas as pd
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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

class LogisticsSaveRequest(BaseModel):
    company_id: str  # ERD의 uuid 타입 (어떤 회사의 데이터인지 필요)
    vendorName: str  # 업체명 (logistics_documents의 vendor_name)
    itemName: str    # 품목명 (inventory_logs의 item_name)
    quantity: int    # 수량 (inventory_logs의 quantity)
    type: str = "IN" # 구분 (ERD의 inventory_logs.type 컬럼용: 기본값 '입고')

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