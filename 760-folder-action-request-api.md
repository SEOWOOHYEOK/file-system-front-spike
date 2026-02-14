# 760. 폴더 작업 요청 API

> 폴더 이동을 관리자에게 요청하고, 승인/반려 워크플로우를 통해 실행하는 API입니다.
> 기존 파일 작업 요청(750)과 동일한 플로우를 폴더에 적용합니다.

## 목차

- [공통 사항](#공통-사항)
- [요청자용 API (760)](#요청자용-api-760)
- [관리자용 API (860)](#관리자용-api-860)
- [기존 API 변경 사항](#기존-api-변경-사항)
- [타입 정의](#타입-정의)
- [에러 코드](#에러-코드)
- [상태 흐름도](#상태-흐름도)

---

## 공통 사항

### 인증

모든 요청에 Bearer 토큰이 필요합니다.

```
Authorization: Bearer <access_token>
```

### 필요 권한

| 권한 코드 | 설명 | 대상 |
|-----------|------|------|
| `FOLDER_MOVE_REQUEST` | 폴더 이동 요청/취소/목록 조회 | 일반 사용자 |
| `FOLDER_MOVE_APPROVE` | 폴더 이동 요청 승인/반려 | 관리자/매니저 |

### Base URL

```
요청자용: /v1/folder-action-requests
관리자용: /v1/admin/folder-action-requests
```

---

## 요청자용 API (760)

### 1. 폴더 이동 요청 생성

관리자에게 폴더 이동을 요청합니다.

```
POST /v1/folder-action-requests/move
```

**권한**: `FOLDER_MOVE_REQUEST`

#### Request Body

```json
{
  "folderId": "550e8400-e29b-41d4-a716-446655440001",
  "targetParentFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "reason": "프로젝트 구조 재정리를 위해 폴더 이동이 필요합니다.",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `folderId` | `uuid` | O | 이동할 폴더 ID |
| `targetParentFolderId` | `uuid` | O | 이동 대상 부모 폴더 ID |
| `reason` | `string` | O | 요청 사유 |
| `designatedApproverId` | `uuid` | O | 승인 대상자 ID (승인자 목록 API로 조회) |

#### Response `201`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FOLDER",
  "type": "FOLDER_MOVE",
  "status": "PENDING",
  "folderId": "550e8400-e29b-41d4-a716-446655440001",
  "folderName": "Documents",
  "sourceParentFolderId": "550e8400-e29b-41d4-a716-446655440099",
  "sourceParentFolderPath": "/Projects",
  "targetParentFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "targetParentFolderPath": "/Archive/2026",
  "requesterId": "user-uuid-here",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "프로젝트 구조 재정리를 위해 폴더 이동이 필요합니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z"
}
```

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | - | 잘못된 요청 (유효성 검증 실패) |
| `404` | `4001` | 폴더를 찾을 수 없음 |
| `404` | `4004` | 대상 부모 폴더를 찾을 수 없음 |
| `409` | `4006` | 자기 자신 또는 하위 폴더로 이동 불가 (순환 이동) |
| `409` | `10102` | 해당 폴더에 이미 PENDING 요청이 존재 |
| `400` | `10107` | 지정된 승인자가 승인 권한을 보유하지 않음 |

---

### 2. 내 폴더 작업 요청 목록 조회

내가 요청했거나 처리한 폴더 작업 요청 목록을 조회합니다.

```
GET /v1/folder-action-requests/my
```

**권한**: `FOLDER_MOVE_REQUEST`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 (`requestedAt`, `updatedAt`, `decidedAt`, `executedAt`, `status`, `type`) |
| `sortOrder` | `string` | X | `desc` | 정렬 순서 (`asc`, `desc`) |
| `status` | `enum` | X | - | 상태 필터 (`PENDING`, `APPROVED`, `REJECTED`, `CANCELED`, `EXECUTED`, `INVALIDATED`, `FAILED`) |
| `type` | `enum` | X | - | 타입 필터 (`FOLDER_MOVE`) |
| `role` | `enum` | X | - | `REQUESTED`: 내가 요청한 건, `PROCESSED`: 내가 처리한 건, 미지정: 둘 다 |

#### Response `200`

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetType": "FOLDER",
      "type": "FOLDER_MOVE",
      "status": "PENDING",
      "folderId": "...",
      "folderName": "Documents",
      "sourceParentFolderId": "...",
      "sourceParentFolderPath": "/Projects",
      "targetParentFolderId": "...",
      "targetParentFolderPath": "/Archive/2026",
      "requesterId": "...",
      "designatedApproverId": "...",
      "reason": "프로젝트 구조 재정리를 위해 폴더 이동이 필요합니다.",
      "requestedAt": "2026-02-14T09:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

---

### 3. 승인자 후보 목록 조회

폴더 이동 요청 시 지정할 수 있는 승인자 목록을 조회합니다.

```
GET /v1/folder-action-requests/approvers
```

**권한**: `FOLDER_MOVE_REQUEST`

#### Response `200`

`FOLDER_MOVE_APPROVE` 권한을 가진 활성 사용자 목록을 반환합니다.

---

### 4. 폴더 작업 요청 상세 조회

```
GET /v1/folder-action-requests/:id
```

**권한**: `FOLDER_MOVE_REQUEST`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Response `200`

`FolderActionRequestResponse` 단건 반환 (null 가능)

---

### 5. 폴더 작업 요청 취소

본인이 생성한 PENDING 상태의 요청만 취소할 수 있습니다.

```
POST /v1/folder-action-requests/:id/cancel
```

**권한**: `FOLDER_MOVE_REQUEST`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Request Body

없음

#### Response `200`

취소된 요청 정보 (`status: "CANCELED"`)

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | `10105` | PENDING이 아닌 상태에서 취소 시도 |
| `403` | `10106` | 본인의 요청이 아닌 경우 |
| `404` | `10101` | 요청을 찾을 수 없음 |

---

## 관리자용 API (860)

### 1. 전체 폴더 작업 요청 목록 조회

```
GET /v1/admin/folder-action-requests
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `page` | `number` | X | 페이지 번호 (기본: 1) |
| `pageSize` | `number` | X | 페이지 크기 (기본: 20) |
| `sortBy` | `string` | X | 정렬 기준 (기본: `requestedAt`) |
| `sortOrder` | `string` | X | 정렬 순서 (기본: `desc`) |
| `status` | `enum` | X | 상태 필터 |
| `type` | `enum` | X | 타입 필터 |
| `requesterId` | `uuid` | X | 요청자 ID 필터 |
| `folderId` | `uuid` | X | 폴더 ID 필터 |
| `requestedFrom` | `ISO 8601` | X | 요청일 시작 (예: `2026-02-01T00:00:00.000Z`) |
| `requestedTo` | `ISO 8601` | X | 요청일 종료 (예: `2026-02-28T23:59:59.000Z`) |

---

### 2. 상태별 요약

```
GET /v1/admin/folder-action-requests/summary
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Response `200`

```json
{
  "PENDING": 5,
  "APPROVED": 0,
  "REJECTED": 2,
  "CANCELED": 1,
  "EXECUTED": 10,
  "INVALIDATED": 0,
  "FAILED": 0
}
```

---

### 3. 내 승인 대기 목록

로그인한 관리자에게 지정된 PENDING 요청만 조회합니다.

```
GET /v1/admin/folder-action-requests/my-pending
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Query Parameters

기본 페이지네이션 파라미터 (`page`, `pageSize`, `sortBy`, `sortOrder`)

---

### 4. 상세 조회

```
GET /v1/admin/folder-action-requests/:id
```

**권한**: `FOLDER_MOVE_APPROVE`

---

### 5. 승인

PENDING 상태의 요청을 승인합니다. 승인 즉시 폴더 이동이 실행됩니다.

```
POST /v1/admin/folder-action-requests/:id/approve
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Request Body

```json
{
  "comment": "확인했습니다. 승인합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `comment` | `string` | X | 승인 코멘트 |

#### Response `200`

승인 후 실행 결과에 따라 `status`가 달라집니다:

| status | 의미 |
|--------|------|
| `EXECUTED` | 폴더 이동 성공 |
| `INVALIDATED` | 폴더 상태가 변경되어 실행 불가 (부모 폴더 변경, 폴더 삭제 등) |
| `FAILED` | 폴더 이동 실행 중 오류 발생 |

---

### 6. 반려

```
POST /v1/admin/folder-action-requests/:id/reject
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Request Body

```json
{
  "comment": "사유가 불충분합니다. 추가 설명이 필요합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `comment` | `string` | **O** | 반려 사유 (필수) |

---

### 7. 일괄 승인

```
POST /v1/admin/folder-action-requests/bulk-approve
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Request Body

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "일괄 승인합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ids` | `uuid[]` | O | 승인할 요청 ID 목록 (최소 1개) |
| `comment` | `string` | X | 승인 코멘트 |

#### Response `200`

`FolderActionRequestResponse[]` 배열 반환

---

### 8. 일괄 반려

```
POST /v1/admin/folder-action-requests/bulk-reject
```

**권한**: `FOLDER_MOVE_APPROVE`

#### Request Body

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "정책 변경으로 인해 일괄 반려합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ids` | `uuid[]` | O | 반려할 요청 ID 목록 (최소 1개) |
| `comment` | `string` | **O** | 반려 사유 (필수) |

---

## 기존 API 변경 사항

### `GET /v1/file-action-requests/my` 에 `targetType` 파라미터 추가

기존 파일 작업 요청 목록 조회 API에서 **폴더 작업 요청도 조회**할 수 있도록 `targetType` 쿼리 파라미터가 추가되었습니다.

#### 추가된 Query Parameter

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `targetType` | `enum` | X | `FILE` | `FILE`: 파일 요청만 (기존 동작), `FOLDER`: 폴더 요청만 |

#### 사용 예시

```
# 기존과 동일 (파일 요청만)
GET /v1/file-action-requests/my

# 파일 요청만 (명시적)
GET /v1/file-action-requests/my?targetType=FILE

# 폴더 요청만
GET /v1/file-action-requests/my?targetType=FOLDER

# 폴더 요청 + 상태 필터
GET /v1/file-action-requests/my?targetType=FOLDER&status=PENDING

# 폴더 요청 + 내가 요청한 건만
GET /v1/file-action-requests/my?targetType=FOLDER&role=REQUESTED
```

#### 응답 구분

응답 객체의 `targetType` 필드로 파일/폴더 요청을 구분합니다:

```typescript
// targetType=FILE인 경우
{
  "targetType": "FILE",
  "type": "MOVE",        // MOVE | DELETE
  "fileId": "...",
  "fileName": "report.pdf",
  "sourceFolderId": "...",
  "sourceFolderPath": "/Documents",
  "targetFolderId": "...",
  "targetFolderPath": "/Archive",
  ...
}

// targetType=FOLDER인 경우
{
  "targetType": "FOLDER",
  "type": "FOLDER_MOVE",
  "folderId": "...",
  "folderName": "Documents",
  "sourceParentFolderId": "...",
  "sourceParentFolderPath": "/Projects",
  "targetParentFolderId": "...",
  "targetParentFolderPath": "/Archive/2026",
  ...
}
```

---

## 타입 정의

### FolderActionRequestResponse

```typescript
interface FolderActionRequestResponse {
  id: string;                          // 요청 ID (UUID)
  targetType: 'FOLDER';               // 항상 'FOLDER'
  type: 'FOLDER_MOVE';                // 작업 타입
  status: FolderActionRequestStatus;   // 요청 상태

  // 대상 폴더 정보
  folderId: string;                    // 이동 대상 폴더 ID
  folderName: string;                  // 폴더명

  // 이동 경로 정보
  sourceParentFolderId?: string;       // 현재 부모 폴더 ID
  sourceParentFolderPath?: string;     // 현재 부모 폴더 경로 (예: "/Projects")
  targetParentFolderId?: string;       // 이동 목표 부모 폴더 ID
  targetParentFolderPath?: string;     // 이동 목표 부모 폴더 경로 (예: "/Archive/2026")

  // 요청자/승인자 정보
  requesterId: string;                 // 요청자 ID
  designatedApproverId: string;        // 지정 승인자 ID
  approverId?: string;                 // 실제 처리자 ID (승인/반려 후 채워짐)

  // 사유/코멘트
  reason: string;                      // 요청 사유
  decisionComment?: string;            // 승인/반려 코멘트
  executionNote?: string;              // INVALIDATED/FAILED 시 상세 사유

  // 타임스탬프
  requestedAt: string;                 // 요청일시 (ISO 8601)
  decidedAt?: string;                  // 결정일시
  executedAt?: string;                 // 실행일시
}
```

### FolderActionRequestStatus

```typescript
type FolderActionRequestStatus =
  | 'PENDING'       // 대기 중 (승인/반려 가능)
  | 'APPROVED'      // 승인됨 (즉시 실행)
  | 'REJECTED'      // 반려됨
  | 'CANCELED'      // 요청자가 취소
  | 'EXECUTED'      // 실행 완료 (폴더 이동 성공)
  | 'INVALIDATED'   // 무효화 (폴더 상태 변경으로 실행 불가)
  | 'FAILED';       // 실행 실패
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 에러 코드

| HTTP | Code | 내부 코드 | 설명 |
|------|------|-----------|------|
| 404 | 10101 | `FOLDER_ACTION_REQUEST_NOT_FOUND` | 폴더 작업 요청을 찾을 수 없음 |
| 409 | 10102 | `FOLDER_ACTION_REQUEST_DUPLICATE` | 해당 폴더에 이미 PENDING 요청이 존재 |
| 400 | 10103 | `FOLDER_ACTION_REQUEST_NOT_APPROVABLE` | 승인할 수 없는 상태 |
| 400 | 10104 | `FOLDER_ACTION_REQUEST_NOT_REJECTABLE` | 반려할 수 없는 상태 |
| 400 | 10105 | `FOLDER_ACTION_REQUEST_NOT_CANCELLABLE` | 취소할 수 없는 상태 |
| 403 | 10106 | `FOLDER_ACTION_REQUEST_NOT_OWNER` | 본인의 요청만 취소 가능 |
| 400 | 10107 | `FOLDER_ACTION_REQUEST_INVALID_APPROVER` | 승인자가 승인 권한 미보유 |
| 404 | 10108 | `FOLDER_ACTION_REQUEST_SOME_NOT_FOUND` | 일괄 처리 시 일부 요청 미발견 |
| 404 | 4001 | `FOLDER_NOT_FOUND` | 폴더를 찾을 수 없음 |
| 404 | 4004 | `FOLDER_TARGET_NOT_FOUND` | 대상 폴더를 찾을 수 없음 |
| 409 | 4006 | `FOLDER_CIRCULAR_MOVE` | 순환 이동 (자기 자신/하위 폴더로 이동 불가) |

---

## 상태 흐름도

```
[요청 생성]
     │
     ▼
  PENDING ──────────────────┐
     │          │           │
     │      [요청자 취소]    │
     │          │           │
     │          ▼           │
     │      CANCELED        │
     │                      │
  [관리자 반려]          [관리자 승인]
     │                      │
     ▼                      ▼
  REJECTED            낙관적 검증
                       │         │
                   [검증 실패]  [검증 성공]
                       │         │
                       ▼         ▼
                  INVALIDATED  폴더 이동 실행
                                │         │
                            [실행 성공]  [실행 실패]
                                │         │
                                ▼         ▼
                            EXECUTED    FAILED
```

### 낙관적 검증 조건

승인 시점에 아래 조건 중 하나라도 불일치하면 `INVALIDATED` 처리됩니다:

1. 요청 시점의 부모 폴더와 현재 부모 폴더가 다름 (누군가 이미 이동시킴)
2. 폴더가 삭제/휴지통 상태로 변경됨

---

## 파일 요청(750) vs 폴더 요청(760) 비교

| 항목 | 파일 요청 (750) | 폴더 요청 (760) |
|------|----------------|----------------|
| Base URL | `/v1/file-action-requests` | `/v1/folder-action-requests` |
| 요청 타입 | `MOVE`, `DELETE` | `FOLDER_MOVE` |
| 대상 식별 | `fileId`, `fileName` | `folderId`, `folderName` |
| 이동 목표 | `targetFolderId` (파일이 들어갈 폴더) | `targetParentFolderId` (폴더의 새 부모) |
| 경로 필드 | `sourceFolderPath`, `targetFolderPath` | `sourceParentFolderPath`, `targetParentFolderPath` |
| 응답 구분 | `targetType: "FILE"` | `targetType: "FOLDER"` |
| 통합 조회 | `GET /v1/file-action-requests/my` | `GET /v1/file-action-requests/my?targetType=FOLDER` |
| 필요 권한 | `FILE_MOVE_REQUEST` | `FOLDER_MOVE_REQUEST` |
| 승인 권한 | `FILE_MOVE_APPROVE` | `FOLDER_MOVE_APPROVE` |
| 삭제 요청 | O (`DELETE`) | X (미지원) |
