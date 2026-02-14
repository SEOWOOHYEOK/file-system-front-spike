# 750. 파일 작업 요청 API

> 파일 이동/삭제를 관리자에게 요청하고, 승인/반려 워크플로우를 통해 실행하는 API입니다.

## 목차

- [공통 사항](#공통-사항)
- [요청자용 API (750)](#요청자용-api-750)
- [관리자용 API (850)](#관리자용-api-850)
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
| `FILE_MOVE_REQUEST` | 파일 이동 요청/취소/목록 조회 | 일반 사용자 |
| `FILE_DELETE_REQUEST` | 파일 삭제 요청 | 일반 사용자 |
| `FILE_MOVE_APPROVE` | 파일 작업 요청 승인/반려 | 관리자/매니저 |

### Base URL

```
요청자용: /v1/file-action-requests
관리자용: /v1/admin/file-action-requests
```

---

## 요청자용 API (750)

### 1. 파일 이동 요청 생성

관리자에게 파일 이동을 요청합니다. 동일 파일에 PENDING 요청이 있으면 차단됩니다.

```
POST /v1/file-action-requests/move
```

**권한**: `FILE_MOVE_REQUEST`

#### Request Body

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `fileId` | `uuid` | O | 이동할 파일 ID |
| `targetFolderId` | `uuid` | O | 이동 대상 폴더 ID |
| `reason` | `string` | O | 요청 사유 |
| `designatedApproverId` | `uuid` | O | 승인 대상자 ID (승인자 목록 API로 조회) |

#### Response `201`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FILE",
  "type": "MOVE",
  "status": "PENDING",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "report.pdf",
  "sourceFolderId": "550e8400-e29b-41d4-a716-446655440099",
  "sourceFolderPath": "/Documents/Reports",
  "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "targetFolderPath": "/Archive/2026",
  "requesterId": "user-uuid-here",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z"
}
```

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | - | 잘못된 요청 (유효성 검증 실패) |
| `400` | `10009` | 지정된 승인자가 승인 권한을 보유하지 않음 |
| `404` | - | 파일 또는 폴더를 찾을 수 없음 |
| `409` | `10002` | 해당 파일에 이미 PENDING 요청이 존재 |

---

### 2. 파일 삭제 요청 생성

관리자에게 파일 삭제를 요청합니다. 동일 파일에 PENDING 요청이 있으면 차단됩니다.

```
POST /v1/file-action-requests/delete
```

**권한**: `FILE_DELETE_REQUEST`

#### Request Body

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "reason": "더 이상 필요하지 않은 파일입니다.",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `fileId` | `uuid` | O | 삭제할 파일 ID |
| `reason` | `string` | O | 요청 사유 |
| `designatedApproverId` | `uuid` | O | 승인 대상자 ID (승인자 목록 API로 조회) |

#### Response `201`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FILE",
  "type": "DELETE",
  "status": "PENDING",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "old-document.pdf",
  "sourceFolderId": "550e8400-e29b-41d4-a716-446655440099",
  "sourceFolderPath": "/Documents/Reports",
  "requesterId": "user-uuid-here",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "더 이상 필요하지 않은 파일입니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z"
}
```

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | - | 잘못된 요청 (유효성 검증 실패) |
| `400` | `10009` | 지정된 승인자가 승인 권한을 보유하지 않음 |
| `404` | - | 파일을 찾을 수 없음 |
| `409` | `10002` | 해당 파일에 이미 PENDING 요청이 존재 |

---

### 3. 내 작업 요청 목록 조회

내가 요청했거나 처리한 작업 요청 목록을 조회합니다. `targetType` 파라미터로 파일/폴더 요청을 구분합니다.

```
GET /v1/file-action-requests/my
```

**권한**: `FILE_MOVE_REQUEST`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 (최소: 1) |
| `pageSize` | `number` | X | `20` | 페이지 크기 (최소: 1, 최대: 100) |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | 정렬 순서 (`asc`, `desc`) |
| `targetType` | `enum` | X | `FILE` | `FILE`: 파일 요청만, `FOLDER`: 폴더 요청만 |
| `status` | `enum` | X | - | 상태 필터 (`PENDING`, `APPROVED`, `REJECTED`, `CANCELED`, `EXECUTED`, `INVALIDATED`, `FAILED`) |
| `type` | `enum` | X | - | 요청 타입 필터 (`MOVE`, `DELETE`) - targetType=FILE일 때만 유효 |
| `role` | `enum` | X | - | `REQUESTED`: 내가 요청한 건, `PROCESSED`: 내가 처리한 건, 미지정: 둘 다 |

#### 사용 예시

```
# 기본 (파일 요청만 조회)
GET /v1/file-action-requests/my

# 파일 요청 + 대기중만
GET /v1/file-action-requests/my?status=PENDING

# 파일 요청 + 이동 요청만
GET /v1/file-action-requests/my?type=MOVE

# 내가 요청한 건만
GET /v1/file-action-requests/my?role=REQUESTED

# 내가 처리한 건만
GET /v1/file-action-requests/my?role=PROCESSED

# 폴더 요청만 조회
GET /v1/file-action-requests/my?targetType=FOLDER

# 폴더 요청 + 대기중 + 내가 요청한 건
GET /v1/file-action-requests/my?targetType=FOLDER&status=PENDING&role=REQUESTED

# 페이지네이션
GET /v1/file-action-requests/my?page=2&pageSize=10&sortOrder=asc
```

#### Response `200`

**targetType=FILE (기본값)인 경우:**

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetType": "FILE",
      "type": "MOVE",
      "status": "PENDING",
      "fileId": "550e8400-e29b-41d4-a716-446655440010",
      "fileName": "report.pdf",
      "sourceFolderId": "550e8400-e29b-41d4-a716-446655440099",
      "sourceFolderPath": "/Documents/Reports",
      "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
      "targetFolderPath": "/Archive/2026",
      "requesterId": "user-uuid-here",
      "designatedApproverId": "approver-uuid-here",
      "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
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

**targetType=FOLDER인 경우:**

```json
{
  "items": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
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
      "reason": "프로젝트 구조 재정리",
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

> **프론트엔드 팁**: 응답의 `targetType` 필드(`"FILE"` 또는 `"FOLDER"`)로 타입을 구분하여 UI를 분기 처리하세요.

---

### 4. 승인 가능 사용자 목록 조회

파일 작업 요청 시 지정할 수 있는 승인자 후보 목록을 조회합니다.

```
GET /v1/file-action-requests/approvers?type=MOVE
```

**권한**: `FILE_MOVE_REQUEST`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `type` | `enum` | **O** | 요청 타입 (`MOVE`, `DELETE`) |

#### 사용 예시

```
# 이동 요청 승인자 목록
GET /v1/file-action-requests/approvers?type=MOVE

# 삭제 요청 승인자 목록
GET /v1/file-action-requests/approvers?type=DELETE
```

#### Response `200`

해당 요청 타입의 승인 권한(`FILE_MOVE_APPROVE`)을 가진 활성 사용자 목록을 반환합니다.

> **프론트엔드 팁**: 이동/삭제 요청 생성 폼에서 승인자 셀렉트박스를 채울 때 이 API를 호출하세요.

---

### 5. 파일 작업 요청 상세 조회

특정 파일 작업 요청의 상세 정보를 조회합니다.

```
GET /v1/file-action-requests/:id
```

**권한**: `FILE_MOVE_REQUEST`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Response `200`

`FileActionRequestResponse` 단건 반환 (존재하지 않으면 `null`)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FILE",
  "type": "MOVE",
  "status": "APPROVED",
  "fileId": "550e8400-e29b-41d4-a716-446655440010",
  "fileName": "report.pdf",
  "sourceFolderId": "550e8400-e29b-41d4-a716-446655440099",
  "sourceFolderPath": "/Documents/Reports",
  "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "targetFolderPath": "/Archive/2026",
  "requesterId": "user-uuid-here",
  "designatedApproverId": "approver-uuid-here",
  "approverId": "approver-uuid-here",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "decisionComment": "확인했습니다. 승인합니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z",
  "decidedAt": "2026-02-14T10:30:00.000Z",
  "executedAt": "2026-02-14T10:30:01.000Z"
}
```

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `404` | `10001` | 요청을 찾을 수 없음 |

---

### 6. 파일 작업 요청 취소

본인이 생성한 PENDING 상태의 요청만 취소할 수 있습니다.

```
POST /v1/file-action-requests/:id/cancel
```

**권한**: `FILE_MOVE_REQUEST`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Request Body

없음

#### Response `200`

취소된 요청 정보 (`status: "CANCELED"`)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FILE",
  "type": "MOVE",
  "status": "CANCELED",
  "fileId": "550e8400-e29b-41d4-a716-446655440010",
  "fileName": "report.pdf",
  "sourceFolderId": "...",
  "sourceFolderPath": "/Documents/Reports",
  "targetFolderId": "...",
  "targetFolderPath": "/Archive/2026",
  "requesterId": "user-uuid-here",
  "designatedApproverId": "approver-uuid-here",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z"
}
```

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | `10005` | PENDING이 아닌 상태에서 취소 시도 |
| `403` | `10006` | 본인의 요청이 아닌 경우 |
| `404` | `10001` | 요청을 찾을 수 없음 |

---

## 관리자용 API (850)

### 1. 전체 파일 작업 요청 목록 조회

모든 파일 작업 요청을 조회합니다. 다양한 필터를 조합할 수 있습니다.

```
GET /v1/admin/file-action-requests
```

**권한**: `FILE_MOVE_APPROVE`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (최대: 100) |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | 정렬 순서 (`asc`, `desc`) |
| `status` | `enum` | X | - | 상태 필터 (`PENDING`, `APPROVED`, `REJECTED`, `CANCELED`, `EXECUTED`, `INVALIDATED`, `FAILED`) |
| `type` | `enum` | X | - | 요청 타입 필터 (`MOVE`, `DELETE`) |
| `requesterId` | `uuid` | X | - | 요청자 ID 필터 |
| `fileId` | `uuid` | X | - | 파일 ID 필터 |
| `requestedFrom` | `ISO 8601` | X | - | 요청일 시작 (예: `2026-02-01T00:00:00.000Z`) |
| `requestedTo` | `ISO 8601` | X | - | 요청일 종료 (예: `2026-02-28T23:59:59.000Z`) |

#### 사용 예시

```
# 전체 목록
GET /v1/admin/file-action-requests

# 대기중인 요청만
GET /v1/admin/file-action-requests?status=PENDING

# 이동 요청만
GET /v1/admin/file-action-requests?type=MOVE

# 특정 사용자의 요청만
GET /v1/admin/file-action-requests?requesterId=user-uuid-here

# 특정 파일의 요청만
GET /v1/admin/file-action-requests?fileId=file-uuid-here

# 기간 필터
GET /v1/admin/file-action-requests?requestedFrom=2026-02-01T00:00:00.000Z&requestedTo=2026-02-14T23:59:59.000Z

# 복합 필터
GET /v1/admin/file-action-requests?status=PENDING&type=DELETE&page=1&pageSize=10
```

#### Response `200`

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetType": "FILE",
      "type": "MOVE",
      "status": "PENDING",
      "fileId": "...",
      "fileName": "report.pdf",
      "sourceFolderId": "...",
      "sourceFolderPath": "/Documents/Reports",
      "targetFolderId": "...",
      "targetFolderPath": "/Archive/2026",
      "requesterId": "...",
      "designatedApproverId": "...",
      "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
      "requestedAt": "2026-02-14T09:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 35,
  "totalPages": 2,
  "hasNext": true,
  "hasPrev": false
}
```

---

### 2. 상태별 요약

전체 파일 작업 요청의 상태별 건수를 조회합니다.

```
GET /v1/admin/file-action-requests/summary
```

**권한**: `FILE_MOVE_APPROVE`

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

> **프론트엔드 팁**: 관리자 대시보드의 배지(badge) 숫자 표시에 활용하세요. 특히 `PENDING` 값으로 미처리 건수를 표시할 수 있습니다.

---

### 3. 내 승인 대기 목록

로그인한 관리자에게 지정된 PENDING 요청만 조회합니다.

```
GET /v1/admin/file-action-requests/my-pending
```

**권한**: `FILE_MOVE_APPROVE`

#### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | 정렬 순서 |

#### Response `200`

`PaginatedResponse<FileActionRequestResponse>` (나에게 지정된 PENDING 건만)

---

### 4. 상세 조회

```
GET /v1/admin/file-action-requests/:id
```

**권한**: `FILE_MOVE_APPROVE`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Response `200`

`FileActionRequestResponse` 단건 반환 (null 가능)

---

### 5. 승인

PENDING 상태의 요청을 승인합니다. 승인 즉시 파일 작업(이동/삭제)이 실행됩니다.

```
POST /v1/admin/file-action-requests/:id/approve
```

**권한**: `FILE_MOVE_APPROVE`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

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
| `EXECUTED` | 파일 작업 성공 (이동 완료 또는 삭제 완료) |
| `INVALIDATED` | 파일 상태가 변경되어 실행 불가 (이미 이동/삭제됨 등) |
| `FAILED` | 파일 작업 실행 중 오류 발생 |

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "targetType": "FILE",
  "type": "MOVE",
  "status": "EXECUTED",
  "fileId": "...",
  "fileName": "report.pdf",
  "sourceFolderId": "...",
  "sourceFolderPath": "/Documents/Reports",
  "targetFolderId": "...",
  "targetFolderPath": "/Archive/2026",
  "requesterId": "...",
  "designatedApproverId": "...",
  "approverId": "admin-uuid-here",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "decisionComment": "확인했습니다. 승인합니다.",
  "requestedAt": "2026-02-14T09:00:00.000Z",
  "decidedAt": "2026-02-14T10:30:00.000Z",
  "executedAt": "2026-02-14T10:30:01.000Z"
}
```

> **프론트엔드 팁**: 승인 후 응답의 `status`를 확인하여 `EXECUTED`이면 성공 메시지, `INVALIDATED`/`FAILED`이면 경고 메시지를 표시하세요.

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | `10003` | 승인할 수 없는 상태 (PENDING이 아님) |
| `404` | `10001` | 요청을 찾을 수 없음 |

---

### 6. 반려

```
POST /v1/admin/file-action-requests/:id/reject
```

**권한**: `FILE_MOVE_APPROVE`

#### Path Parameters

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `uuid` | 요청 ID |

#### Request Body

```json
{
  "comment": "사유가 불충분합니다. 추가 설명이 필요합니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `comment` | `string` | **O** | 반려 사유 (필수) |

#### Response `200`

`FileActionRequestResponse` (status: `"REJECTED"`)

#### Error Responses

| Status | Code | 설명 |
|--------|------|------|
| `400` | `10004` | 반려할 수 없는 상태 (PENDING이 아님) |
| `404` | `10001` | 요청을 찾을 수 없음 |

---

### 7. 일괄 승인

여러 PENDING 요청을 한 번에 승인합니다.

```
POST /v1/admin/file-action-requests/bulk-approve
```

**권한**: `FILE_MOVE_APPROVE`

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

`FileActionRequestResponse[]` 배열 반환 (각 요청별 실행 결과가 `status`에 반영됨)

> **프론트엔드 팁**: 일괄 승인 시 각 항목의 `status`가 다를 수 있습니다 (`EXECUTED`, `INVALIDATED`, `FAILED`). 결과를 개별 확인하여 사용자에게 알려주세요.

---

### 8. 일괄 반려

여러 PENDING 요청을 한 번에 반려합니다.

```
POST /v1/admin/file-action-requests/bulk-reject
```

**권한**: `FILE_MOVE_APPROVE`

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

#### Response `200`

`FileActionRequestResponse[]` 배열 반환

---

## 타입 정의

### FileActionRequestResponse

```typescript
interface FileActionRequestResponse {
  id: string;                          // 요청 ID (UUID)
  targetType: 'FILE';                  // 항상 'FILE'
  type: 'MOVE' | 'DELETE';            // 작업 타입
  status: FileActionRequestStatus;     // 요청 상태

  // 대상 파일 정보
  fileId: string;                      // 파일 ID
  fileName: string;                    // 파일명

  // 이동 경로 정보
  sourceFolderId?: string;             // 원본 폴더 ID
  sourceFolderPath?: string;           // 원본 폴더 경로 (예: "/Documents/Reports")
  targetFolderId?: string;             // 대상 폴더 ID (MOVE인 경우)
  targetFolderPath?: string;           // 대상 폴더 경로 (MOVE인 경우, 예: "/Archive/2026")

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

### FileActionRequestStatus

```typescript
type FileActionRequestStatus =
  | 'PENDING'       // 대기 중 (승인/반려/취소 가능)
  | 'APPROVED'      // 승인됨 (즉시 실행 → EXECUTED/INVALIDATED/FAILED)
  | 'REJECTED'      // 반려됨
  | 'CANCELED'      // 요청자가 취소
  | 'EXECUTED'      // 실행 완료 (이동/삭제 성공)
  | 'INVALIDATED'   // 무효화 (파일 상태 변경으로 실행 불가)
  | 'FAILED';       // 실행 실패
```

### FileActionType

```typescript
type FileActionType = 'MOVE' | 'DELETE';
```

### MyRequestRole

```typescript
type MyRequestRole = 'REQUESTED' | 'PROCESSED';
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;          // 현재 페이지
  pageSize: number;      // 페이지 크기
  totalItems: number;    // 전체 아이템 수
  totalPages: number;    // 전체 페이지 수
  hasNext: boolean;      // 다음 페이지 존재 여부
  hasPrev: boolean;      // 이전 페이지 존재 여부
}
```

---

## 에러 코드

| HTTP | Code | 내부 코드 | 설명 |
|------|------|-----------|------|
| 404 | 10001 | `FILE_ACTION_REQUEST_NOT_FOUND` | 파일 작업 요청을 찾을 수 없음 |
| 409 | 10002 | `FILE_ACTION_REQUEST_DUPLICATE` | 해당 파일에 이미 PENDING 요청이 존재 |
| 400 | 10003 | `FILE_ACTION_REQUEST_NOT_APPROVABLE` | 승인할 수 없는 상태 |
| 400 | 10004 | `FILE_ACTION_REQUEST_NOT_REJECTABLE` | 반려할 수 없는 상태 |
| 400 | 10005 | `FILE_ACTION_REQUEST_NOT_CANCELLABLE` | 취소할 수 없는 상태 |
| 403 | 10006 | `FILE_ACTION_REQUEST_NOT_OWNER` | 본인의 요청만 취소 가능 |
| 409 | 10007 | `FILE_ACTION_REQUEST_INVALIDATED` | 파일 상태가 변경되어 실행 불가 |
| 500 | 10008 | `FILE_ACTION_REQUEST_EXECUTION_FAILED` | 파일 작업 실행 중 오류 |
| 400 | 10009 | `FILE_ACTION_REQUEST_INVALID_APPROVER` | 승인자가 승인 권한 미보유 |
| 404 | 10010 | `FILE_ACTION_REQUEST_SOME_NOT_FOUND` | 일괄 처리 시 일부 요청 미발견 |

### 에러 응답 형식

```json
{
  "statusCode": 409,
  "code": 10002,
  "message": "해당 파일에 대해 이미 처리 대기 중인 요청이 있습니다."
}
```

---

## 상태 흐름도

```
[요청 생성] (POST move / POST delete)
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
                  INVALIDATED  파일 작업 실행
                                │         │
                            [실행 성공]  [실행 실패]
                                │         │
                                ▼         ▼
                            EXECUTED    FAILED
```

### 낙관적 검증 조건

승인 시점에 아래 조건 중 하나라도 불일치하면 `INVALIDATED` 처리됩니다:

1. **MOVE 요청**: 요청 시점의 폴더와 현재 폴더가 다름 (누군가 이미 이동시킴)
2. **DELETE 요청**: 파일이 이미 삭제/휴지통 상태로 변경됨

---

## 프론트엔드 통합 가이드

### 요청 생성 플로우

```
1. 승인자 목록 조회 → GET /v1/file-action-requests/approvers?type=MOVE
2. 사용자가 폼 작성 (파일 선택, 대상 폴더 선택, 사유 입력, 승인자 선택)
3. 요청 생성 → POST /v1/file-action-requests/move (또는 /delete)
4. 성공 시 목록 페이지로 이동 또는 상세 페이지 표시
```

### 상태별 가능한 액션

| 현재 상태 | 요청자 | 관리자 |
|-----------|--------|--------|
| `PENDING` | 취소 가능 | 승인/반려 가능 |
| `APPROVED` | - | - |
| `REJECTED` | - | - |
| `CANCELED` | - | - |
| `EXECUTED` | - | - |
| `INVALIDATED` | - | - |
| `FAILED` | - | - |

### 상태별 UI 색상 권장

| 상태 | 색상 | 뱃지 |
|------|------|------|
| `PENDING` | 노랑/주황 | 대기중 |
| `APPROVED` | 파랑 | 승인됨 |
| `REJECTED` | 빨강 | 반려됨 |
| `CANCELED` | 회색 | 취소됨 |
| `EXECUTED` | 초록 | 완료 |
| `INVALIDATED` | 보라 | 무효화 |
| `FAILED` | 빨강(진함) | 실패 |

### MOVE vs DELETE 요청 차이

| 항목 | MOVE | DELETE |
|------|------|--------|
| `type` 값 | `"MOVE"` | `"DELETE"` |
| `targetFolderId` | O (있음) | X (없음) |
| `targetFolderPath` | O (있음) | X (없음) |
| 필요 권한 | `FILE_MOVE_REQUEST` | `FILE_DELETE_REQUEST` |
| 승인자 조회 | `?type=MOVE` | `?type=DELETE` |
