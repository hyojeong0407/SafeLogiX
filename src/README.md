# SafeLogiX 아키텍처 및 실행 가이드
 
## 프로젝트 구조
 
```
src/
├── backend/         # FastAPI 백엔드 서버
│   ├── main.py          # API 엔드포인트 및 YOLOv10 추론
│   ├── best.pt          # YOLOv10 학습 모델 (별도 전달)
│   └── requirements.txt # Python 패키지 목록
└── frontend/        # React 프론트엔드
    ├── App.tsx          # 메인 앱 및 라우팅
    ├── component/       # 페이지 컴포넌트
    │   ├── CameraConnect.tsx  # 카메라 연결
    │   ├── Cctv.tsx           # 안전 감지 로그
    │   └── Logistics.tsx      # 물류 문서 관리
    └── assets/          # 이미지 리소스
```
 
---
 
## 기술 스택
 
### Backend
| 패키지 | 용도 |
|--------|------|
| FastAPI | REST API 서버 |
| Uvicorn | ASGI 서버 |
| Ultralytics | YOLOv10 모델 추론 |
| OpenCV | 영상 처리 |
| Supabase | 데이터베이스 |
| OpenAI | AI 보고서 생성 |
| WeasyPrint | PDF 보고서 출력 |
 
### Frontend
| 패키지 | 용도 |
|--------|------|
| React 19 | UI 프레임워크 |
| TypeScript | 타입 안전성 |
| Vite | 빌드 도구 |
| Tailwind CSS | 스타일링 |
| Lucide React | 아이콘 |
 
---
 
## 실행 방법
 
### Docker로 실행 (권장)
 
프로젝트 루트(`SafeLogiX/`)에서 실행합니다.
 
```bash
# 최초 실행 또는 코드 수정 후
docker compose up --build

# 만약 빌드 오류 시
docker compose up -d
 
# 이후 실행
docker compose up
 
# 종료
docker compose down
```
 
### 접속
 
| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:5176 |
| 백엔드 API | http://localhost:8000 |
 
---
 
## 환경 변수
 
루트의 `.env.example`을 참고해 `.env` 파일을 생성하세요.
 
| 변수명 | 설명 |
|--------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | Supabase API 키 |
| `OPENAI_API_KEY` | OpenAI API 키 |
 
---
 
## 주의사항
 
- `best.pt` 모델 파일은 용량 문제로 Git에 포함되지 않습니다. 팀원에게 별도로 전달받아 `src/backend/` 폴더에 넣어주세요.
- `.env` 파일은 Git에 포함되지 않습니다. `.env.example`을 참고해 직접 생성해주세요.
- best.pt와 env파일은 필요할 시 별도 전달드리겠습니다.