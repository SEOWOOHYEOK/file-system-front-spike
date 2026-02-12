# 807. 관리자 - 파일 공유요청 현황 및 관리 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `807.관리자-파일 공유요청 현황 및 관리(701-A)` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증 및 권한](#2-인증-및-권한)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 상태별 카운트 조회 (A-1)](#4-api-상세---상태별-카운트-조회-a-1)
5. [API 상세 - 요청 목록 조회 (A-2)](#5-api-상세---요청-목록-조회-a-2)
6. [API 상세 - 요청 상세 조회 (A-3)](#6-api-상세---요청-상세-조회-a-3)
7. [API 상세 - 단건 승인 (A-4)](#7-api-상세---단건-승인-a-4)
8. [API 상세 - 단건 반려 (A-5)](#8-api-상세---단건-반려-a-5)
9. [API 상세 - 일괄 승인 (A-6)](#9-api-상세---일괄-승인-a-6)
10. [API 상세 - 일괄 반려 (A-7)](#10-api-상세---일괄-반려-a-7)
11. [API 상세 - 대상자별 공유 조회 (Q-1)](#11-api-상세---대상자별-공유-조회-q-1)
12. [API 상세 - 파일별 공유 조회 (Q-2)](#12-api-상세---파일별-공유-조회-q-2)
13. [에러 처리](#13-에러-처리)
14. [cURL 테스트](#14-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 필요 권한 |
|--------|------|------|-----------|
| `GET` | `/v1/admin/file-shares-requests/summary` | 상태별 공유 요청 카운트 조회 | `FILE_SHARE_READ` |
| `GET` | `/v1/admin/file-shares-requests` | 공유 요청 목록 조회 (필터+페이지네이션) | `FILE_SHARE_READ` |
| `GET` | `/v1/admin/file-shares-requests/:id` | 공유 요청 상세 조회 | `FILE_SHARE_READ` |
| `POST` | `/v1/admin/file-shares-requests/:id/approve` | 단건 승인 | `FILE_SHARE_APPROVE` |
| `POST` | `/v1/admin/file-shares-requests/:id/reject` | 단건 반려 | `FILE_SHARE_APPROVE` |
| `POST` | `/v1/admin/file-shares-requests/bulk-approve` | 일괄 승인 | `FILE_SHARE_APPROVE` |
| `POST` | `/v1/admin/file-shares-requests/bulk-reject` | 일괄 반려 | `FILE_SHARE_APPROVE` |
| `GET` | `/v1/admin/file-shares-requests/by-target/:userId` | 대상자별 공유 조회 | `FILE_SHARE_READ` |
| `GET` | `/v1/admin/file-shares-requests/by-file/:fileId` | 파일별 공유 조회 | `FILE_SHARE_READ` |

---

## 2. 인증 및 권한

모든 API는 **JWT Bearer Token** + **관리자 권한**이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

> 토큰은 로그인 API (`POST /v1/auth/login`)로 발급받습니다.

### 필요 권한

| 권한 | 설명 | 해당 API |
|------|------|----------|
| `FILE_SHARE_READ` | 공유 요청 조회 (기본) | 모든 API (컨트롤러 레벨 가드) |
| `FILE_SHARE_APPROVE` | 공유 요청 승인/반려 | 단건 승인, 단건 반려, 일괄 승인, 일괄 반려 |

---

## 3. TypeScript 타입 정의

### Enum / 상수

```typescript
/** 공유 요청 상태 */
type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
type SharePermissionType = 'VIEW' | 'DOWNLOAD';
```

| 값 | 설명 |
|----|------|
| `PENDING` | 대기 중 |
| `APPROVED` | 승인됨 |
| `REJECTED` | 반려됨 |
| `CANCELED` | 취소됨 |

| 값 | 설명 |
|----|------|
| `INTERNAL_USER` | 내부 사용자 (조직 내 직원) |
| `EXTERNAL_USER` | 외부 사용자 (사외 인원) |

| 값 | 설명 |
|----|------|
| `VIEW` | 열람만 가능 |
| `DOWNLOAD` | 다운로드 가능 |

### 공통 타입

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

/** 파일 상세 정보 */
interface FileDetail {
  id: string;       // UUID
  name: string;     // 파일명 (확장자 포함)
  mimeType: string; // MIME 타입 (예: application/pdf)
  sizeBytes: number; // 파일 크기 (바이트)
}

/** 내부 사용자 상세 정보 */
interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;     // UUID
  name: string;       // 사용자 이름
  email: string;      // 이메일 주소
  department: string; // 소속 부서명
  position?: string;  // 직급/직책
}

/** 외부 사용자 상세 정보 */
interface ExternalUserDetail {
  type: 'EXTERNAL_USER';
  userId: string;      // UUID
  name: string;        // 사용자 이름
  email: string;       // 이메일 주소
  company?: string;    // 소속 회사명
  department?: string; // 소속 부서명
  phone?: string;      // 연락처 전화번호
}

/** 사용자 상세 (내부 또는 외부) - type 필드로 구분 */
type UserDetail = InternalUserDetail | ExternalUserDetail;

/** 공유 대상 */
interface ShareTarget {
  type: ShareTargetType;
  userId: string; // UUID
}

/** 권한 */
interface Permission {
  type: SharePermissionType;
  maxDownloads?: number; // DOWNLOAD 권한일 때만 사용
}
```

### 요청 타입

```typescript
/** 공유 요청 목록 조회 쿼리 파라미터 */
interface ShareRequestAdminQuery {
  status: ShareRequestStatus;  // 필수
  q?: string;                  // 검색어 (파일명, 요청자명, 대상자명)
  requesterId?: string;        // UUID - 요청자 ID
  fileId?: string;             // UUID - 파일 ID
  targetUserId?: string;       // UUID - 대상 사용자 ID
  requestedFrom?: string;      // ISO 8601 - 요청일 시작
  requestedTo?: string;        // ISO 8601 - 요청일 종료
  periodFrom?: string;         // ISO 8601 - 공유 기간 시작
  periodTo?: string;           // ISO 8601 - 공유 기간 종료
  sort?: string;               // "필드명,방향" (예: "requestedAt,desc")
  page?: number;               // 페이지 번호 (기본값: 1)
  pageSize?: number;           // 페이지 크기 (기본값: 20, 최대: 100)
  sortBy?: string;             // 정렬 기준 필드
  sortOrder?: 'asc' | 'desc';  // 정렬 순서 (기본값: desc)
}

/** 승인 요청 Body */
interface ApproveRequest {
  comment?: string; // 승인 코멘트 (선택)
}

/** 반려 요청 Body */
interface RejectRequest {
  comment: string; // 반려 코멘트 (필수)
}

/** 일괄 승인 요청 Body */
interface BulkApproveRequest {
  ids: string[];    // UUID[] - 승인할 요청 ID 목록 (최소 1개)
  comment?: string; // 승인 코멘트 (선택)
}

/** 일괄 반려 요청 Body */
interface BulkRejectRequest {
  ids: string[];   // UUID[] - 반려할 요청 ID 목록 (최소 1개)
  comment: string; // 반려 코멘트 (필수)
}
```

### 응답 타입

```typescript
/** 상태별 카운트 (A-1) */
interface ShareRequestSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
}

/** 공유 요청 응답 (A-2 목록 항목, A-4 승인 결과, A-5 반려 결과) */
interface ShareRequestResponse {
  id: string;                          // UUID
  status: ShareRequestStatus;
  fileIds: string[];                   // UUID[]
  files?: FileDetail[];                // 공유 파일 상세 정보
  requesterId: string;                 // UUID
  requesterDetail?: InternalUserDetail; // 요청자 상세 정보
  targets: ShareTarget[];
  targetDetails?: EnrichedShareTarget[]; // 대상 상세 정보
  permission: Permission;
  startAt: string;                     // ISO 8601
  endAt: string;                       // ISO 8601
  reason: string;
  designatedApproverId: string;        // UUID
  designatedApproverDetail?: InternalUserDetail;
  approverId?: string;                 // UUID
  approverDetail?: InternalUserDetail;
  decidedAt?: string;                  // ISO 8601
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];            // UUID[]
  requestedAt: string;                 // ISO 8601
}

/** Enriched 공유 대상 */
interface EnrichedShareTarget {
  type: ShareTargetType;
  userId: string;         // UUID
  userDetail?: UserDetail; // 대상 사용자 상세 정보
}

/** 공유 요청 관리자 상세 (A-3) */
interface ShareRequestAdminDetail {
  id: string;                          // UUID
  status: ShareRequestStatus;
  fileIds: string[];                   // UUID[]
  files?: FileDetail[];                // 공유 파일 상세 정보
  requesterId: string;                 // UUID
  requester?: InternalUserDetail;      // 요청자 상세 정보
  targets: Array<{
    type: string;
    userId: string;                    // UUID
    userDetail?: UserDetail;
  }>;
  permission: {
    type: string;
    maxDownloads?: number;
  };
  startAt: string;                     // ISO 8601
  endAt: string;                       // ISO 8601
  reason: string;
  designatedApproverId: string;        // UUID
  designatedApproverDetail?: InternalUserDetail;
  approverId?: string;                 // UUID
  approver?: InternalUserDetail;
  decidedAt?: string;                  // ISO 8601
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];            // UUID[]
  requestedAt: string;                 // ISO 8601
  updatedAt?: string;                  // ISO 8601
}

/** 일괄 결정 응답 (A-6, A-7) */
interface BulkDecisionResponse {
  processedCount: number;
  items: BulkDecisionItem[];
}

interface BulkDecisionItem {
  id: string;      // UUID
  success: boolean;
  error?: string;
}

/** 공유 항목 결과 (Q-1, Q-2 항목) */
interface ShareItemResult {
  source: 'ACTIVE_SHARE' | 'PENDING_REQUEST';
  file: {
    id: string;       // UUID
    name: string;
    path: string;
    mimeType: string;
  };
  requester: InternalUserDetail;
  target: UserDetail;
  approver?: InternalUserDetail;
  isAutoApproved?: boolean;
  decidedAt?: string;       // ISO 8601
  decisionComment?: string;
  reason: string;
  permission: string;       // 'VIEW' | 'DOWNLOAD'
  startAt: string;          // ISO 8601
  endAt: string;            // ISO 8601

  // ACTIVE_SHARE 전용
  publicShareId?: string;        // UUID
  currentViewCount?: number;
  currentDownloadCount?: number;
  isBlocked?: boolean;
  sharedAt?: string;             // ISO 8601

  // PENDING_REQUEST 전용
  shareRequestId?: string;  // UUID
  requestedAt?: string;     // ISO 8601
}

/** 대상자별 공유 조회 응답 (Q-1) */
interface SharesByTargetResponse extends PaginatedResponse<ShareItemResult> {
  target: UserDetail;
  summary: {
    activeShareCount: number;
    pendingRequestCount: number;
    totalViewCount: number;
    totalDownloadCount: number;
  };
}

/** 파일별 공유 조회 응답 (Q-2) */
interface SharesByFileResponse extends PaginatedResponse<ShareItemResult> {
  file: {
    id: string;       // UUID
    name: string;
    path: string;
    mimeType: string;
  };
  summary: {
    activeShareCount: number;
    pendingRequestCount: number;
    totalViewCount: number;
    totalDownloadCount: number;
  };
}
```

---

## 4. API 상세 - 상태별 카운트 조회 (A-1)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/v1/admin/file-shares-requests/summary` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_READ` |

### 설명

관리자가 공유 요청의 상태별 개수를 조회합니다. 대시보드의 상태별 카운트 배지에 사용합니다.

### 응답 예시

```json
{
  "PENDING": 5,
  "APPROVED": 10,
  "REJECTED": 2,
  "CANCELED": 1
}
```

### fetch 예시

```typescript
async function getShareRequestSummary(): Promise<ShareRequestSummary> {
  const response = await fetch('/v1/admin/file-shares-requests/summary', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `401` | 인증 필요 (토큰 없음 또는 만료) |
| `403` | 관리자 권한 필요 |

---

## 5. API 상세 - 요청 목록 조회 (A-2)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/v1/admin/file-shares-requests` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_READ` |

### 설명

관리자가 공유 요청 목록을 필터링 및 페이지네이션으로 조회합니다. 각 항목에 파일/사용자 상세 정보(Enriched 데이터)가 포함됩니다.

### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | **필수** | - | 요청 상태 필터 |
| `q` | `string` | 선택 | - | 검색어 (파일명, 요청자명, 대상자명) |
| `requesterId` | `string` (UUID) | 선택 | - | 요청자 ID |
| `fileId` | `string` (UUID) | 선택 | - | 파일 ID |
| `targetUserId` | `string` (UUID) | 선택 | - | 대상 사용자 ID |
| `requestedFrom` | `string` (ISO 8601) | 선택 | - | 요청일 시작 |
| `requestedTo` | `string` (ISO 8601) | 선택 | - | 요청일 종료 |
| `periodFrom` | `string` (ISO 8601) | 선택 | - | 공유 기간 시작 |
| `periodTo` | `string` (ISO 8601) | 선택 | - | 공유 기간 종료 |
| `sort` | `string` | 선택 | `requestedAt,desc` | 정렬 (예: `"requestedAt,desc"`) |
| `page` | `number` | 선택 | `1` | 페이지 번호 |
| `pageSize` | `number` | 선택 | `20` | 페이지 크기 (최대 100) |
| `sortBy` | `string` | 선택 | - | 정렬 기준 필드 |
| `sortOrder` | `'asc' \| 'desc'` | 선택 | `desc` | 정렬 순서 |

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "PENDING",
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
      "permission": {
        "type": "VIEW",
        "maxDownloads": null
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

### fetch 예시

```typescript
async function getShareRequests(
  query: ShareRequestAdminQuery,
): Promise<PaginatedResponse<ShareRequestResponse>> {
  const params = new URLSearchParams();
  params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  if (query.requesterId) params.set('requesterId', query.requesterId);
  if (query.fileId) params.set('fileId', query.fileId);
  if (query.targetUserId) params.set('targetUserId', query.targetUserId);
  if (query.requestedFrom) params.set('requestedFrom', query.requestedFrom);
  if (query.requestedTo) params.set('requestedTo', query.requestedTo);
  if (query.periodFrom) params.set('periodFrom', query.periodFrom);
  if (query.periodTo) params.set('periodTo', query.periodTo);
  if (query.sort) params.set('sort', query.sort);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const response = await fetch(
    `/v1/admin/file-shares-requests?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |

---

## 6. API 상세 - 요청 상세 조회 (A-3)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/v1/admin/file-shares-requests/:id` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_READ` |

### 설명

특정 공유 요청의 상세 정보를 조회합니다. 파일 상세(이름, 타입, 크기), 요청자/대상자/승인자 정보(이름, 부서, 이메일)가 포함됩니다.

### 경로 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `string` (UUID) | 공유 요청 ID |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "PENDING",
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
  "requester": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "name": "홍길동",
    "email": "hong@company.com",
    "department": "개발팀",
    "position": "선임"
  },
  "targets": [
    {
      "type": "EXTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440004",
      "userDetail": {
        "type": "EXTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440004",
        "name": "박외부",
        "email": "park@external.com",
        "company": "외부회사",
        "department": "영업부"
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
  "approver": null,
  "decidedAt": null,
  "decisionComment": null,
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z",
  "updatedAt": "2026-02-10T09:00:00.000Z"
}
```

### fetch 예시

```typescript
async function getShareRequestDetail(
  id: string,
): Promise<ShareRequestAdminDetail> {
  const response = await fetch(
    `/v1/admin/file-shares-requests/${id}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |
| `404` | 공유 요청을 찾을 수 없음 |

---

## 7. API 상세 - 단건 승인 (A-4)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `/v1/admin/file-shares-requests/:id/approve` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_APPROVE` |

### 설명

특정 공유 요청을 승인합니다.

- 요청 상태가 `APPROVED`로 변경됩니다.
- `PublicShare`가 생성되어 파일 공유가 활성화됩니다.
- 승인자 정보와 승인 일시가 기록됩니다.
- **PENDING 상태의 요청만 승인할 수 있습니다.**

### 경로 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `string` (UUID) | 승인할 공유 요청 ID |

### 요청 Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `comment` | `string` | 선택 | 승인 코멘트 |

### 요청 예시

```json
{
  "comment": "승인합니다."
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "APPROVED",
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
  "permission": { "type": "VIEW" },
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
  "publicShareIds": ["660e8400-e29b-41d4-a716-446655440099"],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

### fetch 예시

```typescript
async function approveShareRequest(
  id: string,
  comment?: string,
): Promise<ShareRequestResponse> {
  const response = await fetch(
    `/v1/admin/file-shares-requests/${id}/approve`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `400` | 승인할 수 없는 상태이거나 중복 요청 |
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |
| `404` | 공유 요청을 찾을 수 없음 |

---

## 8. API 상세 - 단건 반려 (A-5)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `/v1/admin/file-shares-requests/:id/reject` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_APPROVE` |

### 설명

특정 공유 요청을 반려합니다.

- 요청 상태가 `REJECTED`로 변경됩니다.
- 반려자 정보와 반려 일시가 기록됩니다.
- **PENDING 상태의 요청만 반려할 수 있습니다.**
- **반려 코멘트는 필수입니다.**

### 경로 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `string` (UUID) | 반려할 공유 요청 ID |

### 요청 Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `comment` | `string` | **필수** | 반려 코멘트 |

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
  "permission": { "type": "VIEW" },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
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

### fetch 예시

```typescript
async function rejectShareRequest(
  id: string,
  comment: string,
): Promise<ShareRequestResponse> {
  const response = await fetch(
    `/v1/admin/file-shares-requests/${id}/reject`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `400` | 반려할 수 없는 상태 (PENDING이 아님) |
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |
| `404` | 공유 요청을 찾을 수 없음 |

---

## 9. API 상세 - 일괄 승인 (A-6)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `/v1/admin/file-shares-requests/bulk-approve` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_APPROVE` |

### 설명

여러 공유 요청을 한 번에 승인합니다.

- 모든 요청 상태가 `APPROVED`로 변경됩니다.
- 각 요청에 대해 `PublicShare`가 생성됩니다.
- **PENDING 상태의 요청만 승인할 수 있습니다.**
- **중복 요청이 있으면 전체 트랜잭션이 롤백됩니다.**

### 요청 Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ids` | `string[]` (UUID) | **필수** | 승인할 요청 ID 목록 (최소 1개) |
| `comment` | `string` | 선택 | 승인 코멘트 |

### 요청 예시

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "일괄 승인합니다."
}
```

### 응답 예시

```json
{
  "processedCount": 2,
  "items": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "success": true },
    { "id": "550e8400-e29b-41d4-a716-446655440002", "success": true }
  ]
}
```

### fetch 예시

```typescript
async function bulkApproveShareRequests(
  ids: string[],
  comment?: string,
): Promise<BulkDecisionResponse> {
  const response = await fetch(
    '/v1/admin/file-shares-requests/bulk-approve',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids, comment }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `400` | 승인할 수 없는 상태이거나 중복 요청 |
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |

---

## 10. API 상세 - 일괄 반려 (A-7)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `POST` |
| Path | `/v1/admin/file-shares-requests/bulk-reject` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_APPROVE` |

### 설명

여러 공유 요청을 한 번에 반려합니다.

- 모든 요청 상태가 `REJECTED`로 변경됩니다.
- **PENDING 상태의 요청만 반려할 수 있습니다.**
- **반려 코멘트는 필수입니다.**

### 요청 Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ids` | `string[]` (UUID) | **필수** | 반려할 요청 ID 목록 (최소 1개) |
| `comment` | `string` | **필수** | 반려 코멘트 |

### 요청 예시

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "보안 정책에 위배되어 일괄 반려합니다."
}
```

### 응답 예시

```json
{
  "processedCount": 2,
  "items": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "success": true },
    { "id": "550e8400-e29b-41d4-a716-446655440002", "success": true }
  ]
}
```

### fetch 예시

```typescript
async function bulkRejectShareRequests(
  ids: string[],
  comment: string,
): Promise<BulkDecisionResponse> {
  const response = await fetch(
    '/v1/admin/file-shares-requests/bulk-reject',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids, comment }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `400` | 반려할 수 없는 상태 |
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |

---

## 11. API 상세 - 대상자별 공유 조회 (Q-1)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/v1/admin/file-shares-requests/by-target/:userId` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_READ` |

### 설명

특정 사용자에게 공유된 파일 목록을 조회합니다. 활성 공유(`ACTIVE_SHARE`)와 대기 중 요청(`PENDING_REQUEST`)이 통합된 목록으로 반환됩니다.

### 경로 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `userId` | `string` (UUID) | 대상 사용자 ID |

### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | 선택 | `1` | 페이지 번호 |
| `pageSize` | `number` | 선택 | `20` | 페이지 크기 |

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "보고서.pdf",
        "path": "/프로젝트A",
        "mimeType": "application/pdf"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440002",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "target": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440004",
        "name": "김철수",
        "email": "kim@company.com",
        "department": "기획팀"
      },
      "approver": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440003",
        "name": "이영희",
        "email": "lee@company.com",
        "department": "보안팀"
      },
      "isAutoApproved": false,
      "decidedAt": "2026-02-10T10:00:00.000Z",
      "reason": "프로젝트 협업",
      "permission": "VIEW",
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "publicShareId": "660e8400-e29b-41d4-a716-446655440099",
      "currentViewCount": 15,
      "currentDownloadCount": 0,
      "isBlocked": false,
      "sharedAt": "2026-02-10T10:00:00.000Z"
    },
    {
      "source": "PENDING_REQUEST",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "name": "계약서.docx",
        "path": "/법무",
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440005",
        "name": "박민수",
        "email": "park@company.com",
        "department": "법무팀"
      },
      "target": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440004",
        "name": "김철수",
        "email": "kim@company.com",
        "department": "기획팀"
      },
      "reason": "계약서 검토 요청",
      "permission": "DOWNLOAD",
      "startAt": "2026-02-12T00:00:00.000Z",
      "endAt": "2026-03-12T23:59:59.000Z",
      "shareRequestId": "770e8400-e29b-41d4-a716-446655440050",
      "requestedAt": "2026-02-11T14:00:00.000Z"
    }
  ],
  "target": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440004",
    "name": "김철수",
    "email": "kim@company.com",
    "department": "기획팀"
  },
  "summary": {
    "activeShareCount": 3,
    "pendingRequestCount": 2,
    "totalViewCount": 50,
    "totalDownloadCount": 10
  },
  "page": 1,
  "pageSize": 20,
  "totalItems": 5,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### fetch 예시

```typescript
async function getSharesByTarget(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<SharesByTargetResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await fetch(
    `/v1/admin/file-shares-requests/by-target/${userId}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### `source` 필드 분기 처리 (프론트엔드 활용 예시)

```typescript
function renderShareItem(item: ShareItemResult) {
  if (item.source === 'ACTIVE_SHARE') {
    // 활성 공유 - 조회/다운로드 카운트, 차단 여부 표시
    return {
      badge: '활성',
      viewCount: item.currentViewCount ?? 0,
      downloadCount: item.currentDownloadCount ?? 0,
      isBlocked: item.isBlocked ?? false,
      date: item.sharedAt,
    };
  } else {
    // 대기 요청 - 요청일 표시
    return {
      badge: '대기',
      requestId: item.shareRequestId,
      date: item.requestedAt,
    };
  }
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |
| `404` | 사용자를 찾을 수 없음 |

---

## 12. API 상세 - 파일별 공유 조회 (Q-2)

### 기본 정보

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/v1/admin/file-shares-requests/by-file/:fileId` |
| 인증 | Bearer Token |
| 권한 | `FILE_SHARE_READ` |

### 설명

특정 파일에 대한 공유 목록을 조회합니다. 활성 공유(`ACTIVE_SHARE`)와 대기 중 요청(`PENDING_REQUEST`)이 통합된 목록으로 반환됩니다.

### 경로 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `fileId` | `string` (UUID) | 파일 ID |

### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | 선택 | `1` | 페이지 번호 |
| `pageSize` | `number` | 선택 | `20` | 페이지 크기 |

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "보고서.pdf",
        "path": "/프로젝트A",
        "mimeType": "application/pdf"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440002",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "target": {
        "type": "EXTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440050",
        "name": "외부파트너",
        "email": "partner@external.com",
        "company": "파트너사"
      },
      "approver": {
        "type": "INTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440003",
        "name": "이영희",
        "email": "lee@company.com",
        "department": "보안팀"
      },
      "isAutoApproved": false,
      "decidedAt": "2026-02-10T10:00:00.000Z",
      "reason": "파트너사 협업",
      "permission": "DOWNLOAD",
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-03-10T23:59:59.000Z",
      "publicShareId": "660e8400-e29b-41d4-a716-446655440099",
      "currentViewCount": 8,
      "currentDownloadCount": 3,
      "isBlocked": false,
      "sharedAt": "2026-02-10T10:00:00.000Z"
    }
  ],
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "보고서.pdf",
    "path": "/프로젝트A",
    "mimeType": "application/pdf"
  },
  "summary": {
    "activeShareCount": 3,
    "pendingRequestCount": 2,
    "totalViewCount": 50,
    "totalDownloadCount": 10
  },
  "page": 1,
  "pageSize": 20,
  "totalItems": 5,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### fetch 예시

```typescript
async function getSharesByFile(
  fileId: string,
  page = 1,
  pageSize = 20,
): Promise<SharesByFileResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  const response = await fetch(
    `/v1/admin/file-shares-requests/by-file/${fileId}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| `401` | 인증 필요 |
| `403` | 관리자 권한 필요 |
| `404` | 파일을 찾을 수 없음 |

---

## 13. 에러 처리

### 공통 에러 코드

| 상태 코드 | 의미 | 대응 방법 |
|-----------|------|-----------|
| `400` | 잘못된 요청 | 요청 Body/Query 검증 실패. 에러 메시지 확인 후 수정 |
| `401` | 인증 실패 | 토큰 갱신 후 재시도 |
| `403` | 권한 부족 | 관리자 권한(`FILE_SHARE_READ` / `FILE_SHARE_APPROVE`) 확인 |
| `404` | 리소스 없음 | 요청 ID 또는 사용자/파일 ID 확인 |
| `500` | 서버 오류 | 잠시 후 재시도, 지속 시 관리자 문의 |

### 에러 응답 형식

```json
{
  "statusCode": 400,
  "message": "승인할 수 없는 상태입니다.",
  "error": "Bad Request"
}
```

### 통합 에러 핸들러 예시

```typescript
async function handleApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  const message = body?.message || `HTTP Error ${response.status}`;

  switch (response.status) {
    case 400:
      // Validation 에러 - 사용자에게 에러 메시지 표시
      throw new ValidationError(message);
    case 401:
      // 인증 만료 - 토큰 갱신 또는 로그인 페이지 이동
      window.location.href = '/login';
      throw new AuthError(message);
    case 403:
      // 권한 부족 - 관리자 권한 필요 안내
      throw new ForbiddenError('관리자 권한이 필요합니다.');
    case 404:
      throw new NotFoundError(message);
    default:
      throw new ApiError(message, response.status);
  }
}
```

### 주요 비즈니스 에러 시나리오

| 시나리오 | 상태 코드 | 에러 메시지 예시 |
|----------|-----------|-----------------|
| PENDING이 아닌 요청 승인 시도 | `400` | "승인할 수 없는 상태입니다." |
| PENDING이 아닌 요청 반려 시도 | `400` | "반려할 수 없는 상태입니다." |
| 중복 승인 요청 | `400` | "중복된 공유 요청이 존재합니다." |
| 반려 시 코멘트 누락 | `400` | "반려 코멘트는 필수입니다." |
| 일괄 요청 시 빈 ID 배열 | `400` | "최소 1개 이상의 요청 ID가 필요합니다." |
| 잘못된 UUID 형식 | `400` | "요청 ID는 올바른 UUID 형식이어야 합니다." |
| 존재하지 않는 요청 조회 | `404` | "공유 요청을 찾을 수 없습니다." |

---

## 14. cURL 테스트

> 아래 명령에서 `${TOKEN}`을 실제 JWT 토큰으로 교체하세요.

### A-1: 상태별 카운트 조회

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests/summary" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### A-2: 요청 목록 조회 (PENDING 상태, 1페이지)

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests?status=PENDING&page=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### A-2: 검색어 + 날짜 범위 필터

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests?status=PENDING&q=보고서&requestedFrom=2026-02-01T00:00:00.000Z&requestedTo=2026-02-28T23:59:59.999Z&sort=requestedAt,desc" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### A-3: 요청 상세 조회

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### A-4: 단건 승인

```bash
curl -s -X POST "http://localhost:3000/v1/admin/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/approve" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment": "승인합니다."}' | jq
```

### A-5: 단건 반려

```bash
curl -s -X POST "http://localhost:3000/v1/admin/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/reject" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"comment": "보안 정책에 위배됩니다."}' | jq
```

### A-6: 일괄 승인

```bash
curl -s -X POST "http://localhost:3000/v1/admin/file-shares-requests/bulk-approve" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
    "comment": "일괄 승인합니다."
  }' | jq
```

### A-7: 일괄 반려

```bash
curl -s -X POST "http://localhost:3000/v1/admin/file-shares-requests/bulk-reject" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
    "comment": "보안 정책에 위배되어 일괄 반려합니다."
  }' | jq
```

### Q-1: 대상자별 공유 조회

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests/by-target/550e8400-e29b-41d4-a716-446655440004?page=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### Q-2: 파일별 공유 조회

```bash
curl -s -X GET "http://localhost:3000/v1/admin/file-shares-requests/by-file/550e8400-e29b-41d4-a716-446655440010?page=1&pageSize=20" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```
