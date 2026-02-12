# 701-A. 나의 파일 공유 결제 요청 관리 - 프론트엔드 연동 가이드

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [결제 요청 목록 조회](#4-결제-요청-목록-조회)
5. [결제 요청 취소](#5-결제-요청-취소)
6. [에러 처리](#6-에러-처리)
7. [cURL 테스트](#7-curl-테스트)

---

## 1. API 개요

내가 보낸 결제 요청(ShareRequest)을 조회하고 취소하는 API입니다.

| # | Method | URL | 설명 | 권한 |
|---|--------|-----|------|------|
| 1 | `GET` | `/v1/file-shares-requests/my-sent-requests` | 결제 요청 목록 조회 | `FILE_SHARE_READ` |
| 2 | `POST` | `/v1/file-shares-requests/my-sent-requests/:id/cancel` | 결제 요청 취소 | `FILE_SHARE_REQUEST` |

---

## 2. 인증

모든 요청에 Bearer Token이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};
```

---

## 3. TypeScript 타입 정의

### 공통 페이지네이션

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

### 결제 요청 상태 Enum

| 값 | 설명 | UI 표시 예시 |
|----|------|-------------|
| `PENDING` | 대기 중 | 🟡 승인 대기 |
| `APPROVED` | 승인됨 | 🟢 승인 완료 |
| `REJECTED` | 거부됨 | 🔴 거부됨 |
| `CANCELED` | 취소됨 | ⚪ 취소됨 |

```typescript
type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
```

### 결제 요청 목록 아이템

```typescript
interface MySentShareRequestItem {
  /** 항목 출처 (항상 'SHARE_REQUEST') */
  source: 'SHARE_REQUEST';
  /** 결제 요청 ID (UUID) */
  id: string;
  /** 상태 */
  status: ShareRequestStatus;
  /** 파일 ID 목록 (다건 가능) */
  fileIds: string[];
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 요청자 ID (UUID) */
  ownerId: string;
}
```

### 결제 요청 취소 응답

```typescript
interface ShareRequestResponse {
  /** 공유 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: string;
  /** 공유할 파일 ID 목록 */
  fileIds: string[];
  /** 공유 파일 상세 정보 목록 */
  files?: FileDetail[];
  /** 요청자 ID (UUID) */
  requesterId: string;
  /** 요청자 상세 정보 */
  requesterDetail?: InternalUserDetail;
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 공유 대상 상세 정보 목록 */
  targetDetails?: EnrichedShareTarget[];
  /** 부여할 권한 */
  permission: Permission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /** 지정 승인 대상자 ID (UUID) */
  designatedApproverId: string;
  /** 지정 승인자 상세 정보 */
  designatedApproverDetail?: InternalUserDetail;
  /** 실제 승인/반려 처리자 ID (UUID) */
  approverId?: string;
  /** 실제 승인/반려 처리자 상세 정보 */
  approverDetail?: InternalUserDetail;
  /** 결정일시 (ISO 8601) */
  decidedAt?: string;
  /** 결정 코멘트 */
  decisionComment?: string;
  /** 자동 승인 여부 */
  isAutoApproved: boolean;
  /** 생성된 공유 ID 목록 */
  publicShareIds: string[];
  /** 요청일시 (ISO 8601) */
  requestedAt: string;
}

interface FileDetail {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  department?: string;
  position?: string;
}

interface ShareTarget {
  type: string;
  userId: string;
}

interface EnrichedShareTarget extends ShareTarget {
  userDetail?: InternalUserDetail;
}

interface Permission {
  [key: string]: any;
}
```

---

## 4. 결제 요청 목록 조회

### `GET /v1/file-shares-requests/my-sent-requests`

내가 보낸 결제 요청 목록을 페이지네이션과 상태 필터로 조회합니다.

### 요청 파라미터 (Query String)

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | ❌ | - | 상태 필터 (미지정 시 전체 조회) |
| `page` | `number` | ❌ | `1` | 페이지 번호 (1 이상) |
| `pageSize` | `number` | ❌ | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | ❌ | `createdAt` | 정렬 기준 필드 |
| `sortOrder` | `'asc' \| 'desc'` | ❌ | `desc` | 정렬 순서 |

### 응답

```typescript
// 200 OK
PaginatedResponse<MySentShareRequestItem>
```

### fetch 예시

```typescript
async function getMySentShareRequests(
  token: string,
  params?: {
    status?: ShareRequestStatus;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): Promise<PaginatedResponse<MySentShareRequestItem>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(
    `/v1/file-shares-requests/my-sent-requests?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### 응답 예시

```json
{
  "items": [
    {
      "source": "SHARE_REQUEST",
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "PENDING",
      "fileIds": [
        "550e8400-e29b-41d4-a716-446655440010",
        "550e8400-e29b-41d4-a716-446655440011"
      ],
      "createdAt": "2026-02-12T09:00:00.000Z",
      "ownerId": "550e8400-e29b-41d4-a716-446655440002"
    },
    {
      "source": "SHARE_REQUEST",
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "status": "APPROVED",
      "fileIds": [
        "550e8400-e29b-41d4-a716-446655440012"
      ],
      "createdAt": "2026-02-11T14:30:00.000Z",
      "ownerId": "550e8400-e29b-41d4-a716-446655440002"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 2,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

---

## 5. 결제 요청 취소

### `POST /v1/file-shares-requests/my-sent-requests/:id/cancel`

PENDING 상태의 결제 요청을 취소합니다.

### 요청 파라미터 (Path)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | `string (UUID)` | ✅ | 취소할 결제 요청 ID |

### 요청 Body

없음

### 응답

```typescript
// 200 OK
ShareRequestResponse
```

### fetch 예시

```typescript
async function cancelMySentShareRequest(
  token: string,
  requestId: string,
): Promise<ShareRequestResponse> {
  const res = await fetch(
    `/v1/file-shares-requests/my-sent-requests/${requestId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "CANCELED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440010"],
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "name": "보고서.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576
    }
  ],
  "requesterId": "550e8400-e29b-41d4-a716-446655440002",
  "requesterDetail": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "name": "홍길동",
    "email": "hong@company.com",
    "department": "개발팀",
    "position": "선임"
  },
  "targets": [
    { "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440004" }
  ],
  "targetDetails": [
    {
      "type": "INTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440004",
      "userDetail": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440004",
        "name": "김철수",
        "email": "kim@company.com",
        "department": "기획팀",
        "position": "매니저"
      }
    }
  ],
  "permission": { "VIEW": true, "DOWNLOAD": true },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "designatedApproverDetail": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "이영희",
    "email": "lee@company.com",
    "department": "보안팀"
  },
  "approverId": null,
  "decidedAt": null,
  "decisionComment": null,
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

---

## 6. 에러 처리

### 공통 에러

| HTTP 상태 | 설명 | 대응 방법 |
|-----------|------|-----------|
| `401` | 인증 실패 (토큰 없음/만료) | 로그인 페이지로 리다이렉트 |

### 결제 요청 취소 에러

| HTTP 상태 | 설명 | 대응 방법 |
|-----------|------|-----------|
| `400` | 취소할 수 없는 상태 (이미 승인/거부/취소됨) | 목록 새로고침 후 상태 확인 안내 |
| `403` | 본인이 요청한 결제만 취소 가능 | 권한 오류 메시지 표시 |
| `404` | 결제 요청을 찾을 수 없음 | 목록 새로고침 |

### 에러 처리 예시

```typescript
async function handleCancelRequest(token: string, requestId: string) {
  try {
    const result = await cancelMySentShareRequest(token, requestId);
    // 성공: 목록 새로고침 또는 아이템 상태 업데이트
    return result;
  } catch (error) {
    if (error instanceof Response) {
      switch (error.status) {
        case 400:
          alert('이미 처리된 요청입니다. 목록을 새로고침합니다.');
          break;
        case 403:
          alert('본인이 요청한 결제만 취소할 수 있습니다.');
          break;
        case 404:
          alert('요청을 찾을 수 없습니다.');
          break;
      }
    }
    throw error;
  }
}
```

---

## 7. cURL 테스트

### 결제 요청 목록 조회

```bash
# 전체 목록
curl -X GET "http://localhost:3000/v1/file-shares-requests/my-sent-requests" \
  -H "Authorization: Bearer YOUR_TOKEN"

# PENDING 상태만
curl -X GET "http://localhost:3000/v1/file-shares-requests/my-sent-requests?status=PENDING&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# APPROVED 상태, 2페이지
curl -X GET "http://localhost:3000/v1/file-shares-requests/my-sent-requests?status=APPROVED&page=2&pageSize=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 결제 요청 취소

```bash
curl -X POST "http://localhost:3000/v1/file-shares-requests/my-sent-requests/550e8400-e29b-41d4-a716-446655440001/cancel" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```
