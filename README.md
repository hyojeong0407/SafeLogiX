# 🎓 SafeLogiX
물류 현장 작업자 안전 모니터링 시스템

> **팀명:** 이음  
> **구성원:** 홍효정(Frontend), 박정열(Backend)

# 개인 프로젝트 결과 보고서(영상)
20233082 홍효정 https://youtu.be/Dk7HCXG51gk (UI/UX 영상)<br>
20213039 박정열 https://www.youtube.com/watch?v=g2he0eOBKlk (프로그램 시연영상 포함)

## 📝 1. 프로젝트 개요
* **한 줄 요약:** 물류 현장 작업자 안전 모니터링 시스템
* **상세 설명:** YOLOv10 기반 CCTV 영상 분석을 통해 물류 현장 작업자의 안전모 미착용 등 위험 상황을 실시간으로 감지하고 경고 알림을 제공하는 웹 기반 안전 모니터링 시스템입니다.

```
SafeLogiX/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
├── src/
│   ├── backend/         # FastAPI 백엔드
│   │   ├── main.py
│   │   ├── best.pt      # YOLOv10 모델 (별도 전달)
│   │   └── requirements.txt
│   └── frontend/        # React 프론트엔드
│       ├── src/
│       └── package.json
└── docs/
    ├── meetings-logs/   # 회의록
    ├── plans/           # 기획서
    └── presentations/   # 발표자료
```

## 💻 2. 소스코드 및 기술 문서
본 프로젝트의 아키텍처 설계, 기술 스택, 구체적인 빌드 및 실행 방법은 아래 기술 문서(README)를 참고해 주세요.
* 👉 **[소스코드 실행 방법 및 아키텍처 가이드 바로가기](./src/)**

## 📅 3. 산출물 및 문서 아카이브
* 📝 [정기 회의록 폴더](./docs/meeting-logs/)
* 📄 [학술대회 논문 및 보고서 폴더](./docs/papers/)
* 📊 [중간/최종 발표 자료 폴더](./docs/presentations/)