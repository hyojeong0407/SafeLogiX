# SafeLogiX

``` mermaid
erDiagram
    WORKPLACE ||--o{ USER : "has"
    WORKPLACE ||--o{ CAMERA : "manages"
    WORKPLACE ||--o{ SAFETY_LOG : "records"
    WORKPLACE ||--o{ DOCUMENT : "owns"
    WORKPLACE ||--o{ ITEM : "stocks"

    USER ||--o{ DOCUMENT : "uploads/verifies"
    CAMERA ||--o{ SAFETY_LOG : "captures"
    
    DOCUMENT ||--o{ INVENTORY_HISTORY : "triggers"
    ITEM ||--o{ INVENTORY_HISTORY : "tracked_by"

    WORKPLACE {
        uuid id PK
        string name "사업장명"
        string address "주소"
        timestamp created_at
    }

    USER {
        uuid id PK
        uuid workplace_id FK
        string email "이메일(로그인)"
        string password_hash "비밀번호"
        string name "이름"
        string role "ADMIN / STAFF"
    }

    CAMERA {
        uuid id PK
        uuid workplace_id FK
        string name "기기명(예: 1번창고 폰)"
        string location "설치 위치"
        string status "ACTIVE / INACTIVE"
    }

    SAFETY_LOG {
        uuid id PK
        uuid workplace_id FK
        uuid camera_id FK
        string violation_type "NO_HELMET / INTRUSION"
        int severity_score "위험도 점수(1~5)"
        string image_url "캡처 이미지 경로"
        timestamp detected_at "감지 시간"
    }

    DOCUMENT {
        uuid id PK
        uuid workplace_id FK
        uuid uploader_id FK
        string raw_image_url "원본 스캔 파일 경로"
        jsonb parsed_data "AI 추출 데이터(JSON)"
        string status "PENDING / VERIFIED"
        timestamp uploaded_at
        timestamp verified_at
    }

    ITEM {
        uuid id PK
        uuid workplace_id FK
        string name "품목명"
        int current_stock "현재 재고"
        string unit "단위(BOX, EA)"
        timestamp updated_at
    }

    INVENTORY_HISTORY {
        uuid id PK
        uuid item_id FK
        uuid document_id FK
        int change_qty "변동 수량(+/-)"
        string type "IN / OUT"
        timestamp created_at
    }
```
