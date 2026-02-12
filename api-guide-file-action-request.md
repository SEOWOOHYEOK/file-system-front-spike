# 파일 작업 요청 (File Action Request) - 프론트엔드 연동 가이드

> **최종 업데이트:** 2026-02-11  
> **Base URL:** `/v1/file-action-requests` (요청자) / `/v1/admin/file-action-requests` (관리자)

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [요청자 API](#4-요청자-api)
   - 4.1 [이동 요청 생성](#41-이동-요청-생성)
   - 4.2 [삭제 요청 생성](#42-삭제-요청-생성)
   - 4.3 [내 요청 목록 조회](#43-내-요청-목록-조회)
   - 4.4 [승인자 후보 목록 조회](#44-승인자-후보-목록-조회)
   - 4.5 [요청 상세 조회](#45-요청-상세-조회)
   - 4.6 [요청 취소](#46-요청-취소)
5. [관리자 API](#5-관리자-api)
   - 5.1 [전체 요청 목록 조회](#51-전체-요청-목록-조회)
   - 5.2 [상태별 요약](#52-상태별-요약)
   - 5.3 [내 승인 대기 목록](#53-내-승인-대기-목록)
   - 5.4 [요청 상세 조회 (Admin)](#54-요청-상세-조회-admin)
   - 5.5 [요청 승인](#55-요청-승인)
   - 5.6 [요청 반려](#56-요청-반려)
   - 5.7 [일괄 승인](#57-일괄-승인)
   - 5.8 [일괄 반려](#58-일괄-반려)
6. [기존 파일/폴더 API에서의 PENDING 요청 표시](#6-기존-파일폴더-api에서의-pending-요청-표시)
   - 6.1 [파일 단건 조회 (GET /v1/files/:fileId)](#61-파일-단건-조회)
   - 6.2 [폴더 내용 조회 (GET /v1/folders/:folderId/contents)](#62-폴더-내용-조회)
   - 6.3 [프론트엔드 활용 가이드](#63-프론트엔드-활용-가이드)
7. [에러 처리](#7-에러-처리)
8. [상태 머신 (State Machine)](#8-상태-머신)
9. [cURL 테스트](#9-curl-테스트)

---

## 1. API 개요

사용자가 직접 이동/삭제할 수 없는 파일에 대해 Manager/Admin에게 요청 → 승인 → 자동 실행하는 워크플로우입니다.

### 요청자 API (일반 사용자)

| Method | URL | 설명 | 필요 권한 |
|--------|-----|------|-----------|
| `POST` | `/v1/file-action-requests/move` | 파일 이동 요청 생성 | `FILE_MOVE_REQUEST` |
| `POST` | `/v1/file-action-requests/delete` | 파일 삭제 요청 생성 | `FILE_DELETE_REQUEST` |
| `GET` | `/v1/file-action-requests/my` | 내 요청 목록 조회 | `FILE_MOVE_REQUEST` |
| `GET` | `/v1/file-action-requests/approvers?type=MOVE` | 승인자 후보 목록 | `FILE_MOVE_REQUEST` |
| `GET` | `/v1/file-action-requests/:id` | 요청 상세 조회 | `FILE_MOVE_REQUEST` |
| `POST` | `/v1/file-action-requests/:id/cancel` | 요청 취소 | `FILE_MOVE_REQUEST` |

### 관리자 API (Manager/Admin)

| Method | URL | 설명 | 필요 권한 |
|--------|-----|------|-----------|
| `GET` | `/v1/admin/file-action-requests` | 전체 요청 목록 (필터) | `FILE_MOVE_APPROVE` |
| `GET` | `/v1/admin/file-action-requests/summary` | 상태별 요약 | `FILE_MOVE_APPROVE` |
| `GET` | `/v1/admin/file-action-requests/my-pending` | 내 승인 대기 목록 | `FILE_MOVE_APPROVE` |
| `GET` | `/v1/admin/file-action-requests/:id` | 요청 상세 조회 | `FILE_MOVE_APPROVE` |
| `POST` | `/v1/admin/file-action-requests/:id/approve` | 요청 승인 (즉시 실행) | `FILE_MOVE_APPROVE` |
| `POST` | `/v1/admin/file-action-requests/:id/reject` | 요청 반려 | `FILE_MOVE_APPROVE` |
| `POST` | `/v1/admin/file-action-requests/bulk-approve` | 일괄 승인 | `FILE_MOVE_APPROVE` |
| `POST` | `/v1/admin/file-action-requests/bulk-reject` | 일괄 반려 | `FILE_MOVE_APPROVE` |

---

## 2. 인증

모든 API는 JWT Bearer Token 인증이 필요합니다.

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${accessToken}`,
};
```

---

## 3. TypeScript 타입 정의

### Enum 정의

```typescript
/** 요청 타입 */
type FileActionType = 'MOVE' | 'DELETE';

/** 요청 상태 */
type FileActionRequestStatus =
  | 'PENDING'       // 승인 대기
  | 'APPROVED'      // 승인됨 (실행 직전 과도 상태)
  | 'REJECTED'      // 반려됨
  | 'CANCELED'      // 요청자가 취소
  | 'EXECUTED'      // 실행 완료 (이동/삭제 성공)
  | 'INVALIDATED'   // 무효화 (승인 시 파일 상태 변경됨)
  | 'FAILED';       // 실행 실패 (기술적 오류)
```

### 응답 타입

```typescript
/** 파일 작업 요청 응답 */
interface FileActionRequestResponse {
  id: string;                        // 요청 ID (UUID)
  type: FileActionType;              // 'MOVE' | 'DELETE'
  status: FileActionRequestStatus;   // 현재 상태
  fileId: string;                    // 대상 파일 ID (UUID)
  fileName: string;                  // 파일명
  sourceFolderId?: string;           // 원본 폴더 ID (UUID)
  targetFolderId?: string;           // 대상 폴더 ID (UUID, MOVE인 경우만)
  requesterId: string;               // 요청자 ID (UUID)
  designatedApproverId: string;      // 지정 승인자 ID (UUID)
  approverId?: string;               // 실제 처리자 ID (UUID)
  reason: string;                    // 요청 사유
  decisionComment?: string;          // 승인/반려 코멘트
  executionNote?: string;            // 실행 메모 (INVALIDATED/FAILED 시)
  requestedAt: string;               // 요청일시 (ISO 8601)
  decidedAt?: string;                // 결정일시 (ISO 8601)
  executedAt?: string;               // 실행일시 (ISO 8601)
}
```

### 페이지네이션 응답 타입

```typescript
/** 페이지네이션 응답 래퍼 */
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

### 요청 타입

```typescript
/** 이동 요청 생성 */
interface CreateMoveRequest {
  fileId: string;                // 이동할 파일 ID (UUID, 필수)
  targetFolderId: string;        // 대상 폴더 ID (UUID, 필수)
  reason: string;                // 요청 사유 (필수)
  designatedApproverId: string;  // 승인 대상자 ID (UUID, 필수)
}

/** 삭제 요청 생성 */
interface CreateDeleteRequest {
  fileId: string;                // 삭제할 파일 ID (UUID, 필수)
  reason: string;                // 요청 사유 (필수)
  designatedApproverId: string;  // 승인 대상자 ID (UUID, 필수)
}

/** 승인 요청 */
interface ApproveRequest {
  comment?: string;              // 승인 코멘트 (선택)
}

/** 반려 요청 */
interface RejectRequest {
  comment: string;               // 반려 사유 (필수)
}

/** 일괄 승인 요청 */
interface BulkApproveRequest {
  ids: string[];                 // 요청 ID 목록 (UUID[], 최소 1개)
  comment?: string;              // 승인 코멘트 (선택)
}

/** 일괄 반려 요청 */
interface BulkRejectRequest {
  ids: string[];                 // 요청 ID 목록 (UUID[], 최소 1개)
  comment: string;               // 반려 사유 (필수)
}
```

### 쿼리 파라미터 타입

```typescript
/** 내 요청 목록 쿼리 */
interface MyRequestsQuery {
  page?: number;                        // 페이지 (기본: 1)
  pageSize?: number;                    // 크기 (기본: 20, 최대: 100)
  sortBy?: string;                      // 정렬 기준 (기본: 'requestedAt')
  sortOrder?: 'asc' | 'desc';          // 정렬 순서 (기본: 'desc')
  status?: FileActionRequestStatus;     // 상태 필터 (선택)
  type?: FileActionType;                // 타입 필터 (선택)
}

/** 관리자 요청 목록 쿼리 */
interface AdminRequestsQuery extends MyRequestsQuery {
  requesterId?: string;                 // 요청자 ID 필터 (UUID, 선택)
  fileId?: string;                      // 파일 ID 필터 (UUID, 선택)
  requestedFrom?: string;               // 요청일 시작 (ISO 8601, 선택)
  requestedTo?: string;                 // 요청일 종료 (ISO 8601, 선택)
}

/** 상태별 요약 응답 */
interface StatusSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
  EXECUTED: number;
  INVALIDATED: number;
  FAILED: number;
}
```

---

## 4. 요청자 API

### 4.1 이동 요청 생성

관리자에게 파일 이동을 요청합니다. 동일 파일에 PENDING 요청이 있으면 409로 차단됩니다.

**`POST /v1/file-action-requests/move`**

**요청 Body:**

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**응답 (201):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "PENDING",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "report.pdf",
  "sourceFolderId": "660e8400-e29b-41d4-a716-446655440010",
  "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
  "requesterId": "770e8400-e29b-41d4-a716-446655440020",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "requestedAt": "2026-02-11T09:00:00.000Z"
}
```

**fetch 예시:**

```typescript
const createMoveRequest = async (data: CreateMoveRequest): Promise<FileActionRequestResponse> => {
  const response = await fetch('/v1/file-action-requests/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

**에러 응답:**

| HTTP | 코드 | 상황 |
|------|------|------|
| 400 | `FILE_ACTION_REQUEST_INVALID_APPROVER` (10009) | 승인자가 이동 승인 권한이 없음 |
| 404 | `FILE_NOT_FOUND` (1001) | 파일이 존재하지 않거나 비활성 상태 |
| 404 | `FOLDER_NOT_FOUND` (4001) | 대상 폴더가 존재하지 않거나 비활성 상태 |
| 409 | `FILE_ACTION_REQUEST_DUPLICATE` (10002) | 해당 파일에 이미 PENDING 요청이 존재 |

> **409 중복 시 context에 기존 요청 정보 포함:**
> ```json
> {
>   "code": 10002,
>   "message": "해당 파일에 대해 이미 처리 대기 중인 요청이 있습니다.",
>   "context": {
>     "existingRequestId": "기존요청ID",
>     "requesterId": "기존요청자ID",
>     "type": "MOVE",
>     "designatedApproverId": "기존승인자ID",
>     "fileName": "report.pdf",
>     "requestedAt": "2026-02-10T09:00:00.000Z",
>     "targetFolderId": "폴더ID"
>   }
> }
> ```

---

### 4.2 삭제 요청 생성

관리자에게 파일 삭제를 요청합니다.

**`POST /v1/file-action-requests/delete`**

**요청 Body:**

```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "reason": "더 이상 필요하지 않은 파일입니다.",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**응답 (201):**

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "type": "DELETE",
  "status": "PENDING",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "old-data.xlsx",
  "sourceFolderId": "660e8400-e29b-41d4-a716-446655440010",
  "requesterId": "770e8400-e29b-41d4-a716-446655440020",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "reason": "더 이상 필요하지 않은 파일입니다.",
  "requestedAt": "2026-02-11T09:05:00.000Z"
}
```

**fetch 예시:**

```typescript
const createDeleteRequest = async (data: CreateDeleteRequest): Promise<FileActionRequestResponse> => {
  const response = await fetch('/v1/file-action-requests/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

**에러 응답:** 이동 요청과 동일 (4.1 참조). 단, 폴더 관련 에러 없음.

---

### 4.3 내 요청 목록 조회

로그인한 사용자가 생성한 파일 작업 요청 목록을 조회합니다.

**`GET /v1/file-action-requests/my`**

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | number | 선택 | `1` | 페이지 번호 |
| `pageSize` | number | 선택 | `20` | 페이지 크기 (최대 100) |
| `sortBy` | string | 선택 | `requestedAt` | 정렬 기준 |
| `sortOrder` | `asc` \| `desc` | 선택 | `desc` | 정렬 순서 |
| `status` | FileActionRequestStatus | 선택 | - | 상태 필터 |
| `type` | `MOVE` \| `DELETE` | 선택 | - | 타입 필터 |

**응답 (200):**

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "MOVE",
      "status": "PENDING",
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "report.pdf",
      "sourceFolderId": "660e8400-e29b-41d4-a716-446655440010",
      "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
      "requesterId": "770e8400-e29b-41d4-a716-446655440020",
      "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
      "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
      "requestedAt": "2026-02-11T09:00:00.000Z"
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

**fetch 예시:**

```typescript
const getMyRequests = async (
  query: MyRequestsQuery = {},
): Promise<PaginatedResponse<FileActionRequestResponse>> => {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.status) params.set('status', query.status);
  if (query.type) params.set('type', query.type);

  const response = await fetch(`/v1/file-action-requests/my?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 4.4 승인자 후보 목록 조회

파일 작업 요청 생성 시, 승인자를 지정하기 위한 후보 목록을 조회합니다.

**`GET /v1/file-action-requests/approvers?type=MOVE`**

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `type` | `MOVE` \| `DELETE` | **필수** | 요청 타입 (해당 권한 보유자만 반환) |

**응답 (200):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저",
    "isActive": true,
    "roleId": "role-manager-id"
  }
]
```

> **참고:** 응답은 `User` 엔티티 배열입니다. `MOVE` → `FILE_MOVE_APPROVE` 권한 보유자, `DELETE` → `FILE_DELETE_APPROVE` 권한 보유자가 반환됩니다.

**fetch 예시:**

```typescript
const getApprovers = async (type: FileActionType): Promise<ApproverUser[]> => {
  const response = await fetch(`/v1/file-action-requests/approvers?type=${type}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 4.5 요청 상세 조회

**`GET /v1/file-action-requests/:id`**

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | UUID | 요청 ID |

**응답 (200):** `FileActionRequestResponse` (3장 타입 참조)

**fetch 예시:**

```typescript
const getRequestDetail = async (id: string): Promise<FileActionRequestResponse | null> => {
  const response = await fetch(`/v1/file-action-requests/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  return response.json();
};
```

---

### 4.6 요청 취소

본인이 생성한 PENDING 상태의 요청만 취소할 수 있습니다.

**`POST /v1/file-action-requests/:id/cancel`**

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | UUID | 요청 ID |

**요청 Body:** 없음

**응답 (200):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "CANCELED",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "report.pdf",
  "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
  "requestedAt": "2026-02-11T09:00:00.000Z"
}
```

**fetch 예시:**

```typescript
const cancelRequest = async (id: string): Promise<FileActionRequestResponse> => {
  const response = await fetch(`/v1/file-action-requests/${id}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

**에러 응답:**

| HTTP | 코드 | 상황 |
|------|------|------|
| 400 | `FILE_ACTION_REQUEST_NOT_CANCELLABLE` (10005) | PENDING이 아닌 상태에서 취소 시도 |
| 403 | `FILE_ACTION_REQUEST_NOT_OWNER` (10006) | 본인의 요청이 아닌 경우 |
| 404 | `FILE_ACTION_REQUEST_NOT_FOUND` (10001) | 요청 ID가 존재하지 않음 |

---

## 5. 관리자 API

### 5.1 전체 요청 목록 조회

관리자가 모든 파일 작업 요청을 필터링하여 조회합니다.

**`GET /v1/admin/file-action-requests`**

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | number | 선택 | `1` | 페이지 번호 |
| `pageSize` | number | 선택 | `20` | 페이지 크기 (최대 100) |
| `sortBy` | string | 선택 | `requestedAt` | 정렬 기준 |
| `sortOrder` | `asc` \| `desc` | 선택 | `desc` | 정렬 순서 |
| `status` | FileActionRequestStatus | 선택 | - | 상태 필터 |
| `type` | `MOVE` \| `DELETE` | 선택 | - | 타입 필터 |
| `requesterId` | UUID | 선택 | - | 요청자 ID 필터 |
| `fileId` | UUID | 선택 | - | 파일 ID 필터 |
| `requestedFrom` | ISO 8601 | 선택 | - | 요청일 시작 |
| `requestedTo` | ISO 8601 | 선택 | - | 요청일 종료 |

**응답 (200):** `PaginatedResponse<FileActionRequestResponse>`

**fetch 예시:**

```typescript
const getAllRequests = async (
  query: AdminRequestsQuery = {},
): Promise<PaginatedResponse<FileActionRequestResponse>> => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });

  const response = await fetch(`/v1/admin/file-action-requests?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 5.2 상태별 요약

각 상태별 요청 건수를 반환합니다. 대시보드 카운트 표시에 사용합니다.

**`GET /v1/admin/file-action-requests/summary`**

**응답 (200):**

```json
{
  "PENDING": 5,
  "APPROVED": 0,
  "REJECTED": 2,
  "CANCELED": 1,
  "EXECUTED": 15,
  "INVALIDATED": 1,
  "FAILED": 0
}
```

**fetch 예시:**

```typescript
const getSummary = async (): Promise<StatusSummary> => {
  const response = await fetch('/v1/admin/file-action-requests/summary', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 5.3 내 승인 대기 목록

로그인한 관리자에게 지정된 PENDING 요청 목록을 조회합니다.

**`GET /v1/admin/file-action-requests/my-pending`**

**쿼리 파라미터:** 페이지네이션만 (`page`, `pageSize`, `sortBy`, `sortOrder`)

**응답 (200):** `PaginatedResponse<FileActionRequestResponse>`

**fetch 예시:**

```typescript
const getMyPendingApprovals = async (
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<FileActionRequestResponse>> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

  const response = await fetch(`/v1/admin/file-action-requests/my-pending?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.json();
};
```

---

### 5.4 요청 상세 조회 (Admin)

**`GET /v1/admin/file-action-requests/:id`**

4.5와 동일한 응답 형식. 관리자 권한이 필요합니다.

---

### 5.5 요청 승인

PENDING 상태의 요청을 승인합니다. **승인 시 즉시 실행됩니다** (낙관적 검증 후 파일 이동/삭제 자동 수행).

**`POST /v1/admin/file-action-requests/:id/approve`**

**요청 Body:**

```json
{
  "comment": "확인했습니다. 승인합니다."
}
```

> `comment`는 선택 필드입니다. 빈 Body `{}`도 가능합니다.

**응답 (200) - 실행 성공:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "EXECUTED",
  "fileId": "550e8400-e29b-41d4-a716-446655440001",
  "fileName": "report.pdf",
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "decisionComment": "확인했습니다. 승인합니다.",
  "decidedAt": "2026-02-11T10:00:00.000Z",
  "executedAt": "2026-02-11T10:00:01.000Z",
  "requestedAt": "2026-02-11T09:00:00.000Z"
}
```

**응답 (200) - 무효화 (INVALIDATED):**

승인 시 파일의 현재 상태가 요청 시점과 달라진 경우:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "INVALIDATED",
  "executionNote": "파일 위치 변경됨 (요청 시점: folder-a, 현재: folder-c)",
  "decidedAt": "2026-02-11T10:00:00.000Z"
}
```

**응답 (200) - 실행 실패 (FAILED):**

승인 후 파일 작업 실행 중 기술적 오류 발생 시:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "FAILED",
  "executionNote": "NAS 연결 실패",
  "decidedAt": "2026-02-11T10:00:00.000Z"
}
```

> **중요:** 승인 API는 항상 200을 반환하지만, `status` 필드를 확인해야 합니다.
> - `EXECUTED` → 정상 완료
> - `INVALIDATED` → 파일 상태 변경으로 실행 불가 (사용자에게 안내 필요)
> - `FAILED` → 기술적 오류 (재시도 또는 관리자 문의 안내)

**fetch 예시:**

```typescript
const approveRequest = async (
  id: string,
  comment?: string,
): Promise<FileActionRequestResponse> => {
  const response = await fetch(`/v1/admin/file-action-requests/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ comment }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const result = await response.json();

  // 승인 후 상태에 따른 분기 처리
  if (result.status === 'EXECUTED') {
    // 성공 토스트
  } else if (result.status === 'INVALIDATED') {
    // 파일 상태 변경 안내
  } else if (result.status === 'FAILED') {
    // 실행 실패 안내
  }

  return result;
};
```

**에러 응답:**

| HTTP | 코드 | 상황 |
|------|------|------|
| 400 | `FILE_ACTION_REQUEST_NOT_APPROVABLE` (10003) | PENDING이 아닌 상태에서 승인 시도 |
| 404 | `FILE_ACTION_REQUEST_NOT_FOUND` (10001) | 요청 ID가 존재하지 않음 |

---

### 5.6 요청 반려

PENDING 상태의 요청을 반려합니다. 반려 사유는 필수입니다.

**`POST /v1/admin/file-action-requests/:id/reject`**

**요청 Body:**

```json
{
  "comment": "사유가 불충분합니다. 추가 설명이 필요합니다."
}
```

**응답 (200):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "MOVE",
  "status": "REJECTED",
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "decisionComment": "사유가 불충분합니다. 추가 설명이 필요합니다.",
  "decidedAt": "2026-02-11T10:00:00.000Z",
  "requestedAt": "2026-02-11T09:00:00.000Z"
}
```

**fetch 예시:**

```typescript
const rejectRequest = async (id: string, comment: string): Promise<FileActionRequestResponse> => {
  const response = await fetch(`/v1/admin/file-action-requests/${id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ comment }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

**에러 응답:**

| HTTP | 코드 | 상황 |
|------|------|------|
| 400 | `FILE_ACTION_REQUEST_NOT_REJECTABLE` (10004) | PENDING이 아닌 상태에서 반려 시도 |
| 400 | - | `comment`가 비어있거나 누락됨 |
| 404 | `FILE_ACTION_REQUEST_NOT_FOUND` (10001) | 요청 ID가 존재하지 않음 |

---

### 5.7 일괄 승인

여러 PENDING 요청을 한 번에 승인합니다.

**`POST /v1/admin/file-action-requests/bulk-approve`**

**요청 Body:**

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "일괄 승인합니다."
}
```

**응답 (200):** `FileActionRequestResponse[]`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "EXECUTED",
    "type": "MOVE"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "status": "INVALIDATED",
    "type": "DELETE",
    "executionNote": "파일 상태 변경됨 (요청 시점: ACTIVE, 현재: TRASHED)"
  }
]
```

> **참고:** 개별 요청 단위로 처리되므로, 일부는 `EXECUTED`이고 일부는 `INVALIDATED` 또는 `FAILED`일 수 있습니다.

**fetch 예시:**

```typescript
const bulkApprove = async (
  ids: string[],
  comment?: string,
): Promise<FileActionRequestResponse[]> => {
  const response = await fetch('/v1/admin/file-action-requests/bulk-approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ids, comment }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

---

### 5.8 일괄 반려

여러 PENDING 요청을 한 번에 반려합니다. 반려 사유는 필수입니다.

**`POST /v1/admin/file-action-requests/bulk-reject`**

**요청 Body:**

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "정책 변경으로 인해 일괄 반려합니다."
}
```

**응답 (200):** `FileActionRequestResponse[]`

**fetch 예시:**

```typescript
const bulkReject = async (
  ids: string[],
  comment: string,
): Promise<FileActionRequestResponse[]> => {
  const response = await fetch('/v1/admin/file-action-requests/bulk-reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ids, comment }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

---

## 6. 기존 파일/폴더 API에서의 PENDING 요청 표시

파일 정보 조회 및 폴더 내용 조회 시, 해당 파일에 PENDING 상태의 작업 요청이 있으면 `pendingActionRequest` 필드로 함께 반환됩니다. 이를 통해 사용자가 파일 탐색 중에 이동/삭제 요청 상황을 즉시 확인할 수 있습니다.

### TypeScript 타입 정의

```typescript
/** PENDING 작업 요청 상세 정보 (파일 단건 조회용) */
interface PendingActionRequestDetail {
  id: string;                        // 요청 ID (UUID)
  type: 'MOVE' | 'DELETE';           // 요청 타입
  status: 'PENDING';                 // 항상 'PENDING'
  requesterId: string;               // 요청자 ID (UUID)
  designatedApproverId: string;      // 지정 승인자 ID (UUID)
  reason: string;                    // 요청 사유
  requestedAt: string;               // 요청일시 (ISO 8601)
  targetFolderId?: string;           // 이동 대상 폴더 ID (MOVE인 경우만)
}

/** PENDING 작업 요청 요약 정보 (폴더 목록 조회용) */
interface PendingActionRequestSummary {
  id: string;                        // 요청 ID (UUID)
  type: 'MOVE' | 'DELETE';           // 요청 타입
  status: 'PENDING';                 // 항상 'PENDING'
  requestedAt: string;               // 요청일시 (ISO 8601)
}
```

### 6.1 파일 단건 조회

**`GET /v1/files/:fileId`**

기존 `FileInfoResponse`에 `pendingActionRequest` 필드가 추가됩니다.

**응답 (200) — PENDING 요청이 있는 경우:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "report.pdf",
  "folderId": "660e8400-e29b-41d4-a716-446655440010",
  "path": "/문서/report.pdf",
  "size": 1024000,
  "mimeType": "application/pdf",
  "state": "ACTIVE",
  "storageStatus": {
    "cache": "AVAILABLE",
    "nas": "AVAILABLE"
  },
  "createdBy": "770e8400-e29b-41d4-a716-446655440020",
  "createdAt": "2026-02-10T09:00:00.000Z",
  "updatedAt": "2026-02-10T09:00:00.000Z",
  "checksum": "sha256-abc123...",
  "pendingActionRequest": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "type": "MOVE",
    "status": "PENDING",
    "requesterId": "770e8400-e29b-41d4-a716-446655440020",
    "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
    "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
    "requestedAt": "2026-02-11T10:30:00.000Z",
    "targetFolderId": "880e8400-e29b-41d4-a716-446655440030"
  }
}
```

**응답 (200) — PENDING 요청이 없는 경우:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "report.pdf",
  "pendingActionRequest": null
}
```

> **참고:** `pendingActionRequest` 필드는 항상 존재합니다. PENDING 요청이 없으면 `null`입니다.

---

### 6.2 폴더 내용 조회

**`GET /v1/folders/:folderId/contents`**

기존 `FileListItemInFolder`에 `pendingActionRequest` 필드가 추가됩니다 (축약 형태).

**응답 (200):**

```json
{
  "folderId": "660e8400-e29b-41d4-a716-446655440010",
  "path": "/문서",
  "breadcrumbs": [{ "id": "root-id", "name": "ROOT" }],
  "folders": [],
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "report.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "storageStatus": { "cache": "AVAILABLE", "nas": "AVAILABLE" },
      "updatedAt": "2026-02-10T09:00:00.000Z",
      "pendingActionRequest": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "type": "MOVE",
        "status": "PENDING",
        "requestedAt": "2026-02-11T10:30:00.000Z"
      }
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "name": "data.xlsx",
      "size": 512000,
      "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "storageStatus": { "cache": "AVAILABLE", "nas": "AVAILABLE" },
      "updatedAt": "2026-02-10T08:00:00.000Z",
      "pendingActionRequest": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

> **목록 vs 상세 차이:**
> - **목록** (`FileListItemInFolder`): `id`, `type`, `status`, `requestedAt` — 뱃지 표시용
> - **상세** (`FileInfoResponse`): 위 필드 + `requesterId`, `designatedApproverId`, `reason`, `targetFolderId` — 상세 정보 표시용

---

### 6.3 프론트엔드 활용 가이드

**파일 목록에서 뱃지 표시:**

```typescript
const FileListItem = ({ file }: { file: FileListItemInFolder }) => {
  return (
    <div className="file-item">
      <span>{file.name}</span>

      {file.pendingActionRequest && (
        <Badge
          variant={file.pendingActionRequest.type === 'MOVE' ? 'warning' : 'danger'}
        >
          {file.pendingActionRequest.type === 'MOVE' ? '이동 요청 중' : '삭제 요청 중'}
        </Badge>
      )}
    </div>
  );
};
```

**파일 상세에서 요청 정보 표시:**

```typescript
const FileDetail = ({ fileInfo }: { fileInfo: FileInfoResponse }) => {
  const pending = fileInfo.pendingActionRequest;

  return (
    <div>
      <h2>{fileInfo.name}</h2>

      {pending && (
        <Alert variant="warning">
          <p>
            이 파일에 대한 {pending.type === 'MOVE' ? '이동' : '삭제'} 요청이 
            승인 대기 중입니다.
          </p>
          <p>요청 사유: {pending.reason}</p>
          <p>요청일: {new Date(pending.requestedAt).toLocaleDateString()}</p>
          <a href={`/file-action-requests/${pending.id}`}>
            요청 상세 보기
          </a>
        </Alert>
      )}
    </div>
  );
};
```

**중복 요청 사전 차단 (UX 개선):**

```typescript
const handleMoveRequest = async (fileId: string) => {
  // 파일 정보를 먼저 조회하여 PENDING 요청이 있는지 확인
  const fileInfo = await getFileInfo(fileId);

  if (fileInfo.pendingActionRequest) {
    const pending = fileInfo.pendingActionRequest;
    alert(
      `이미 ${pending.type === 'MOVE' ? '이동' : '삭제'} 요청이 진행 중입니다.\n` +
      `요청일: ${new Date(pending.requestedAt).toLocaleDateString()}`
    );
    return; // 요청 폼을 열지 않음
  }

  // 요청 폼 열기
  openMoveRequestForm(fileId);
};
```

> **성능 참고:** 폴더 내용 조회 시 파일별로 개별 쿼리하지 않고, 해당 폴더의 모든 파일 ID를 IN 쿼리로 한 번에 조회합니다. 추가 DB 쿼리는 1회뿐이므로 성능 부담이 거의 없습니다.

---

## 7. 에러 처리

### 도메인 에러 코드

| 코드 | internalCode | HTTP | 메시지 | 대응 |
|------|-------------|------|--------|------|
| 10001 | `FILE_ACTION_REQUEST_NOT_FOUND` | 404 | 파일 작업 요청을 찾을 수 없습니다. | 목록 새로고침 |
| 10002 | `FILE_ACTION_REQUEST_DUPLICATE` | 409 | 해당 파일에 대해 이미 처리 대기 중인 요청이 있습니다. | context의 기존 요청 정보를 사용자에게 표시 |
| 10003 | `FILE_ACTION_REQUEST_NOT_APPROVABLE` | 400 | 승인할 수 없는 상태의 요청입니다. | 목록 새로고침 (이미 처리됨) |
| 10004 | `FILE_ACTION_REQUEST_NOT_REJECTABLE` | 400 | 반려할 수 없는 상태의 요청입니다. | 목록 새로고침 (이미 처리됨) |
| 10005 | `FILE_ACTION_REQUEST_NOT_CANCELLABLE` | 400 | 취소할 수 없는 상태의 요청입니다. | 목록 새로고침 (이미 처리됨) |
| 10006 | `FILE_ACTION_REQUEST_NOT_OWNER` | 403 | 본인의 요청만 취소할 수 있습니다. | 권한 없음 안내 |
| 10007 | `FILE_ACTION_REQUEST_INVALIDATED` | 409 | 파일 상태가 변경되어 요청을 실행할 수 없습니다. | 파일 상태 변경 안내 |
| 10008 | `FILE_ACTION_REQUEST_EXECUTION_FAILED` | 500 | 파일 작업 실행 중 오류가 발생했습니다. | 관리자 문의 안내 |
| 10009 | `FILE_ACTION_REQUEST_INVALID_APPROVER` | 400 | 지정된 승인자가 승인 권한을 보유하고 있지 않습니다. | 다른 승인자 선택 안내 |
| 10010 | `FILE_ACTION_REQUEST_SOME_NOT_FOUND` | 404 | 일부 요청을 찾을 수 없습니다. | 목록 새로고침 |

### 공통 에러 응답 형태

```typescript
interface ErrorResponse {
  code: number;          // 에러 코드 (예: 10002)
  internalCode: string;  // 내부 식별자 (예: 'FILE_ACTION_REQUEST_DUPLICATE')
  message: string;       // 사용자 메시지 (한국어)
  context?: Record<string, unknown>;  // 추가 정보 (선택)
}
```

### 에러 핸들링 예시

```typescript
const handleApiError = (error: ErrorResponse) => {
  switch (error.code) {
    case 10002: // 중복 요청
      const existing = error.context as {
        existingRequestId: string;
        fileName: string;
        requestedAt: string;
      };
      alert(`이미 "${existing.fileName}" 파일에 대한 요청이 있습니다. (${new Date(existing.requestedAt).toLocaleDateString()})`);
      break;

    case 10003: // 승인 불가
    case 10004: // 반려 불가
    case 10005: // 취소 불가
      alert('이미 처리된 요청입니다. 목록을 새로고침합니다.');
      refreshList();
      break;

    case 10006: // 권한 없음
      alert('본인의 요청만 취소할 수 있습니다.');
      break;

    case 10009: // 잘못된 승인자
      alert('선택한 승인자가 승인 권한이 없습니다. 다른 승인자를 선택해주세요.');
      break;

    default:
      alert(error.message || '오류가 발생했습니다.');
  }
};
```

---

## 8. 상태 머신

```
PENDING ──→ APPROVED ──→ EXECUTED       (정상 완료)
   │              ├──→ INVALIDATED     (파일 상태 변경)
   │              └──→ FAILED          (기술적 오류)
   ├──→ REJECTED                       (승인자 반려)
   └──→ CANCELED                       (요청자 취소)
```

### 상태별 UI 매핑 가이드

| 상태 | 라벨 | 색상 (권장) | 설명 |
|------|------|-------------|------|
| `PENDING` | 승인 대기 | 🟡 Yellow/Orange | 승인자의 결정을 기다리는 중 |
| `APPROVED` | 승인됨 | 🔵 Blue | 과도 상태 (거의 즉시 EXECUTED/INVALIDATED/FAILED로 전환) |
| `REJECTED` | 반려됨 | 🔴 Red | 승인자가 반려함 |
| `CANCELED` | 취소됨 | ⚪ Gray | 요청자가 직접 취소함 |
| `EXECUTED` | 실행 완료 | 🟢 Green | 파일 이동/삭제가 성공적으로 완료됨 |
| `INVALIDATED` | 무효화 | 🟠 Orange/Warning | 승인 시 파일 상태가 변경되어 실행 불가 |
| `FAILED` | 실행 실패 | 🔴 Red/Error | 기술적 오류로 실행 실패 |

### 요청 타입별 아이콘 가이드

| 타입 | 라벨 | 아이콘 (권장) |
|------|------|---------------|
| `MOVE` | 이동 요청 | 📁 / ArrowRight |
| `DELETE` | 삭제 요청 | 🗑️ / Trash |

---

## 9. cURL 테스트

```bash
# 변수 설정
TOKEN="your-jwt-token-here"
BASE="http://localhost:3000"

# ─── 요청자 API ───

# 이동 요청 생성
curl -X POST "$BASE/v1/file-action-requests/move" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fileId": "550e8400-e29b-41d4-a716-446655440001",
    "targetFolderId": "550e8400-e29b-41d4-a716-446655440002",
    "reason": "프로젝트 정리를 위해 이동이 필요합니다.",
    "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
  }'

# 삭제 요청 생성
curl -X POST "$BASE/v1/file-action-requests/delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fileId": "550e8400-e29b-41d4-a716-446655440001",
    "reason": "더 이상 필요하지 않은 파일입니다.",
    "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
  }'

# 내 요청 목록 (PENDING만)
curl "$BASE/v1/file-action-requests/my?status=PENDING&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"

# 승인자 후보 (MOVE 권한)
curl "$BASE/v1/file-action-requests/approvers?type=MOVE" \
  -H "Authorization: Bearer $TOKEN"

# 요청 상세 조회
curl "$BASE/v1/file-action-requests/REQUEST_ID_HERE" \
  -H "Authorization: Bearer $TOKEN"

# 요청 취소
curl -X POST "$BASE/v1/file-action-requests/REQUEST_ID_HERE/cancel" \
  -H "Authorization: Bearer $TOKEN"

# ─── 관리자 API ───

# 전체 요청 목록 (PENDING만, 최근순)
curl "$BASE/v1/admin/file-action-requests?status=PENDING&sortBy=requestedAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"

# 상태별 요약
curl "$BASE/v1/admin/file-action-requests/summary" \
  -H "Authorization: Bearer $TOKEN"

# 내 승인 대기 목록
curl "$BASE/v1/admin/file-action-requests/my-pending" \
  -H "Authorization: Bearer $TOKEN"

# 승인
curl -X POST "$BASE/v1/admin/file-action-requests/REQUEST_ID_HERE/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"comment": "승인합니다."}'

# 반려
curl -X POST "$BASE/v1/admin/file-action-requests/REQUEST_ID_HERE/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"comment": "사유가 불충분합니다."}'

# 일괄 승인
curl -X POST "$BASE/v1/admin/file-action-requests/bulk-approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ids": ["ID1", "ID2"],
    "comment": "일괄 승인합니다."
  }'

# 일괄 반려
curl -X POST "$BASE/v1/admin/file-action-requests/bulk-reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ids": ["ID1", "ID2"],
    "comment": "정책 변경으로 일괄 반려합니다."
  }'
```
