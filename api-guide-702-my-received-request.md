# 내가 받은 공유 요청 관리 (702) - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `702.내가 받은 파일 공유 결제 요청 관리(701-A)` 섹션에서 직접 테스트 가능
>
> **필요 권한:** `FILE_SHARE_APPROVE` — 승인자 역할이 할당된 사용자만 접근 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [받은 공유 요청 목록 조회](#4-받은-공유-요청-목록-조회)
5. [받은 공유 요청 상세 조회](#5-받은-공유-요청-상세-조회)
6. [받은 공유 요청 승인](#6-받은-공유-요청-승인)
7. [받은 공유 요청 반려](#7-받은-공유-요청-반려)
8. [Enum 값 정리](#8-enum-값-정리)
9. [에러 처리](#9-에러-처리)
10. [cURL 테스트](#10-curl-테스트)

---

## 1. API 개요

`designatedApproverId`로 지정된 승인자가 자신에게 할당된 공유 요청을 조회/승인/반려하는 API입니다.

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/v1/file-shares-requests/received` | 받은 공유 요청 목록 | Bearer |
| `GET` | `/v1/file-shares-requests/received/:id` | 받은 공유 요청 상세 조회 | Bearer |
| `POST` | `/v1/file-shares-requests/received/:id/approve` | 받은 공유 요청 승인 | Bearer |
| `POST` | `/v1/file-shares-requests/received/:id/reject` | 받은 공유 요청 반려 | Bearer |

---

## 2. 인증

모든 API는 JWT Bearer Token이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

> 토큰은 로그인 API (`POST /v1/auth/login`)로 발급받습니다.
>
> 추가로 `FILE_SHARE_APPROVE` 권한이 필요합니다. 권한이 없으면 403 응답이 반환됩니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/my-received-request.ts

// ─── Enum 타입 ───

/** 공유 요청 상태 */
type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
type SharePermissionType = 'VIEW' | 'DOWNLOAD';

// ─── 공통 타입 ───

/** 공유 대상 */
export interface ShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
}

/** 공유 권한 */
export interface Permission {
  /** 권한 타입: VIEW(열람만) 또는 DOWNLOAD(다운로드 가능) */
  type: SharePermissionType;
  /** 최대 다운로드 횟수 (DOWNLOAD 권한일 때만 사용) */
  maxDownloads?: number;
}

/** 파일 상세 정보 */
export interface FileDetail {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 (확장자 포함) */
  name: string;
  /** MIME 타입 (예: application/pdf) */
  mimeType: string;
  /** 파일 크기 (바이트) */
  sizeBytes: number;
}

/** 내부 사용자 상세 정보 */
export interface InternalUserDetail {
  type: 'INTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 사용자 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 부서 */
  department: string;
  /** 직급/직책 */
  position?: string;
}

/** 대상자 상세 정보 (사용자 정보 포함) */
export interface EnrichedShareTarget {
  type: ShareTargetType;
  userId: string;
  /** 대상 사용자 상세 정보 (조회 실패 시 undefined) */
  userDetail?: InternalUserDetail;
}

// ─── 요청 타입 ───

/** GET /v1/file-shares-requests/received 쿼리 파라미터 */
export interface ReceivedRequestQuery {
  /** 요청 상태 필터 (미지정 시 PENDING) */
  status?: ShareRequestStatus;
  /** 페이지 번호 (기본값: 1) */
  page?: number;
  /** 페이지 크기 (기본값: 20, 최대: 100) */
  pageSize?: number;
  /** 정렬 기준 필드 (기본값: requestedAt) */
  sortBy?: string;
  /** 정렬 순서 (기본값: desc) */
  sortOrder?: 'asc' | 'desc';
}

/** POST /v1/file-shares-requests/received/:id/approve 요청 */
export interface ApproveReceivedRequest {
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** POST /v1/file-shares-requests/received/:id/reject 요청 */
export interface RejectReceivedRequest {
  /** 반려 코멘트 (필수) */
  comment: string;
}

// ─── 응답 타입 ───

/** 공유 요청 응답 (모든 엔드포인트 공통) */
export interface ShareRequestResponse {
  /** 공유 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: ShareRequestStatus;
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
  /** 대상자 상세 정보 목록 */
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
  /** 실제 승인/반려 처리자 ID (UUID) — 처리 후에만 존재 */
  approverId?: string;
  /** 실제 처리자 상세 정보 — 처리 후에만 존재 */
  approverDetail?: InternalUserDetail;
  /** 결정일시 (ISO 8601) — 처리 후에만 존재 */
  decidedAt?: string;
  /** 결정 코멘트 — 처리 후에만 존재 */
  decisionComment?: string;
  /** 자동 승인 여부 */
  isAutoApproved: boolean;
  /** 생성된 공유 ID 목록 — 승인 후에만 존재 */
  publicShareIds: string[];
  /** 요청일시 (ISO 8601) */
  requestedAt: string;
}

// ─── 페이지네이션 ───

export interface PaginatedResponse<T> {
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

## 4. 받은 공유 요청 목록 조회

본인에게 지정된(`designatedApproverId`) 공유 요청 목록을 페이지네이션으로 조회합니다.

### 요청

```
GET /v1/file-shares-requests/received
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | X | `PENDING` | 요청 상태 필터 |
| `page` | `number` | X | `1` | 페이지 번호 (1 이상) |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `'asc' \| 'desc'` | X | `desc` | 정렬 순서 |

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "PENDING",
      "fileIds": [
        "550e8400-e29b-41d4-a716-446655440010"
      ],
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
        {
          "type": "INTERNAL_USER",
          "userId": "550e8400-e29b-41d4-a716-446655440004"
        }
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
      "permission": {
        "type": "VIEW"
      },
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
      "approverDetail": null,
      "decidedAt": null,
      "decisionComment": null,
      "isAutoApproved": false,
      "publicShareIds": [],
      "requestedAt": "2026-02-10T09:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 50,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

### Enriched 데이터 설명

각 항목에는 파일/사용자 상세 정보가 포함됩니다:

| 필드 | 설명 |
|------|------|
| `files` | 공유 파일 상세 (이름, MIME타입, 크기) |
| `requesterDetail` | 요청자 정보 (이름, 부서, 이메일) |
| `targetDetails` | 대상자 정보 (이름, 부서, 이메일) |
| `designatedApproverDetail` | 지정 승인자 정보 |
| `approverDetail` | 실제 처리자 정보 (승인/반려 후) |

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
async function getReceivedRequests(
  params: ReceivedRequestQuery = {}
): Promise<PaginatedResponse<ShareRequestResponse>> {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const response = await fetch(
    `/v1/file-shares-requests/received?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// 사용 예시: 대기 중인 요청 조회
const pendingRequests = await getReceivedRequests({ status: 'PENDING' });

// 사용 예시: 승인된 요청 조회 (최신순)
const approvedRequests = await getReceivedRequests({
  status: 'APPROVED',
  sortBy: 'requestedAt',
  sortOrder: 'desc',
});
```

---

## 5. 받은 공유 요청 상세 조회

본인에게 지정된 공유 요청의 상세 정보를 조회합니다. 파일 상세(이름, 타입, 크기), 요청자/대상자/승인자 정보(이름, 부서, 이메일)가 포함됩니다.

### 요청

```
GET /v1/file-shares-requests/received/:id
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "PENDING",
  "fileIds": [
    "550e8400-e29b-41d4-a716-446655440010",
    "550e8400-e29b-41d4-a716-446655440011"
  ],
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "name": "보고서.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "name": "설계도.dwg",
      "mimeType": "application/acad",
      "sizeBytes": 5242880
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
    {
      "type": "INTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440004"
    }
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
  "permission": {
    "type": "DOWNLOAD",
    "maxDownloads": 5
  },
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
  "approverDetail": null,
  "decidedAt": null,
  "decisionComment": null,
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 본인에게 지정된 공유 요청만 조회할 수 있음 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function getReceivedRequestDetail(
  requestId: string
): Promise<ShareRequestResponse> {
  const response = await fetch(
    `/v1/file-shares-requests/received/${requestId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();

    if (response.status === 403) {
      // 본인에게 지정되지 않은 요청
      alert('본인에게 지정된 공유 요청만 조회할 수 있습니다.');
    }

    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 6. 받은 공유 요청 승인

본인에게 지정된 공유 요청을 승인합니다.

### 주의사항

- **PENDING** 상태의 요청만 승인할 수 있습니다.
- 본인에게 지정된(`designatedApproverId`) 공유 요청만 승인할 수 있습니다.
- 승인 시 **PublicShare가 자동 생성**됩니다.

### 요청

```
POST /v1/file-shares-requests/received/:id/approve
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 승인할 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

#### Body 필드

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `comment` | `string` | X | 승인 코멘트 | `"승인합니다."` |

### 요청 예시

```json
{
  "comment": "승인합니다."
}
```

> Body를 비워도 됩니다 (`{}` 또는 `{ "comment": undefined }`).

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "APPROVED",
  "fileIds": [
    "550e8400-e29b-41d4-a716-446655440010"
  ],
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
    {
      "type": "INTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440004"
    }
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
  "permission": {
    "type": "VIEW"
  },
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
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "approverDetail": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "이영희",
    "email": "lee@company.com",
    "department": "보안팀"
  },
  "decidedAt": "2026-02-10T10:00:00.000Z",
  "decisionComment": "승인합니다.",
  "isAutoApproved": false,
  "publicShareIds": [
    "660e8400-e29b-41d4-a716-446655440020"
  ],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

> 승인 후 `status`가 `APPROVED`로 변경되고, `approverId`, `approverDetail`, `decidedAt`, `decisionComment`, `publicShareIds`가 채워집니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 승인할 수 없는 상태 (이미 승인/거부/취소됨) | 상태 확인 후 UI 반영 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 본인에게 지정된 공유 요청만 승인할 수 있음 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function approveReceivedRequest(
  requestId: string,
  comment?: string
): Promise<ShareRequestResponse> {
  const response = await fetch(
    `/v1/file-shares-requests/received/${requestId}/approve`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    }
  );

  if (!response.ok) {
    const error = await response.json();

    if (response.status === 400) {
      // 이미 처리된 요청
      alert('이미 처리된 요청입니다.');
    }
    if (response.status === 403) {
      alert('본인에게 지정된 공유 요청만 승인할 수 있습니다.');
    }

    throw new Error(error.message);
  }

  return response.json();
}

// 사용 예시
const approved = await approveReceivedRequest(
  '550e8400-e29b-41d4-a716-446655440001',
  '승인합니다.'
);
console.log(approved.status);           // "APPROVED"
console.log(approved.publicShareIds);   // 생성된 공유 링크 ID 목록
```

---

## 7. 받은 공유 요청 반려

본인에게 지정된 공유 요청을 반려합니다.

### 주의사항

- **PENDING** 상태의 요청만 반려할 수 있습니다.
- 본인에게 지정된(`designatedApproverId`) 공유 요청만 반려할 수 있습니다.
- **반려 코멘트는 필수**입니다.

### 요청

```
POST /v1/file-shares-requests/received/:id/reject
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 반려할 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

#### Body 필드

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `comment` | `string` | **O** | 반려 코멘트 | `"보안 정책에 위배됩니다."` |

### 요청 예시

```json
{
  "comment": "보안 정책에 위배됩니다."
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "REJECTED",
  "fileIds": [
    "550e8400-e29b-41d4-a716-446655440010"
  ],
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
    {
      "type": "INTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440004"
    }
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
  "permission": {
    "type": "VIEW"
  },
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
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "approverDetail": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "이영희",
    "email": "lee@company.com",
    "department": "보안팀"
  },
  "decidedAt": "2026-02-10T10:30:00.000Z",
  "decisionComment": "보안 정책에 위배됩니다.",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

> 반려 후 `status`가 `REJECTED`로 변경되고, `publicShareIds`는 빈 배열로 유지됩니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 반려할 수 없는 상태 또는 반려 코멘트 누락 | 상태 및 입력값 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 본인에게 지정된 공유 요청만 반려할 수 있음 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function rejectReceivedRequest(
  requestId: string,
  comment: string  // 필수!
): Promise<ShareRequestResponse> {
  const response = await fetch(
    `/v1/file-shares-requests/received/${requestId}/reject`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    }
  );

  if (!response.ok) {
    const error = await response.json();

    if (response.status === 400) {
      // 이미 처리된 요청 또는 코멘트 누락
      const messages = Array.isArray(error.message) ? error.message : [error.message];
      messages.forEach((msg: string) => console.error(msg));
    }
    if (response.status === 403) {
      alert('본인에게 지정된 공유 요청만 반려할 수 있습니다.');
    }

    throw new Error(error.message);
  }

  return response.json();
}

// 사용 예시
const rejected = await rejectReceivedRequest(
  '550e8400-e29b-41d4-a716-446655440001',
  '보안 정책에 위배됩니다.'
);
console.log(rejected.status);  // "REJECTED"
```

---

## 8. Enum 값 정리

### ShareRequestStatus

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `PENDING` | 대기 중 | 승인 대기 |
| `APPROVED` | 승인됨 | 승인 완료 |
| `REJECTED` | 거부됨 | 반려 |
| `CANCELED` | 취소됨 | 요청 취소 |

### ShareTargetType

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `INTERNAL_USER` | 내부 사용자 (직원) | 내부 |
| `EXTERNAL_USER` | 외부 사용자 (사외 인원) | 외부 |

### SharePermissionType

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `VIEW` | 열람만 가능 | 열람 |
| `DOWNLOAD` | 다운로드 가능 | 다운로드 |

---

## 9. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "올바른 요청 상태가 아닙니다.",
    "반려 코멘트는 필수입니다."
  ],
  "error": "Bad Request"
}
```

> `message`는 배열로 올 수 있습니다. 각 항목을 필드별로 매핑하여 표시하세요.

### 에러 처리 유틸리티

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();

    if (response.status === 401) {
      // 토큰 만료 → 로그인 페이지로
      redirectToLogin();
    }

    throw error;
  }

  return response.json();
}
```

---

## 10. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "approver@company.com", "password": "password"}' | jq -r '.accessToken')

# 받은 공유 요청 목록 (대기 중)
curl -X GET "http://localhost:3000/v1/file-shares-requests/received?status=PENDING&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# 받은 공유 요청 목록 (승인됨)
curl -X GET "http://localhost:3000/v1/file-shares-requests/received?status=APPROVED" \
  -H "Authorization: Bearer $TOKEN" | jq

# 받은 공유 요청 상세 조회
curl -X GET http://localhost:3000/v1/file-shares-requests/received/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer $TOKEN" | jq

# 받은 공유 요청 승인
curl -X POST http://localhost:3000/v1/file-shares-requests/received/550e8400-e29b-41d4-a716-446655440001/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "승인합니다."}' | jq

# 받은 공유 요청 반려 (comment 필수)
curl -X POST http://localhost:3000/v1/file-shares-requests/received/550e8400-e29b-41d4-a716-446655440001/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "보안 정책에 위배됩니다."}' | jq
```
