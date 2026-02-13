# 관리자 - 파일 공유요청 현황 및 관리 (807) - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `807.관리자-파일 공유요청 현황 및 관리(701-A)` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [A-1: 상태별 카운트 조회](#4-a-1-상태별-카운트-조회)
5. [A-2: 요청 목록 조회](#5-a-2-요청-목록-조회)
6. [A-3: 요청 상세 조회](#6-a-3-요청-상세-조회)
7. [A-4: 단건 승인](#7-a-4-단건-승인)
8. [A-5: 단건 반려](#8-a-5-단건-반려)
9. [A-6: 일괄 승인](#9-a-6-일괄-승인)
10. [A-7: 일괄 반려](#10-a-7-일괄-반려)
11. [Q-1: 대상자별 공유 조회](#11-q-1-대상자별-공유-조회)
12. [Q-2: 파일별 공유 조회](#12-q-2-파일별-공유-조회)
13. [Q-3: 파일별 전체 목록 조회](#13-q-3-파일별-전체-목록-조회)
14. [Q-4: 대상자별 전체 목록 조회](#14-q-4-대상자별-전체-목록-조회)
15. [Enum 값 정리](#15-enum-값-정리)
16. [에러 처리](#16-에러-처리)
17. [cURL 테스트](#17-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/admin/file-shares-requests/summary` | 상태별 카운트 조회 | Bearer | FILE_SHARE_READ |
| `GET` | `/v1/admin/file-shares-requests` | 요청 목록 조회 (필터+페이지네이션) | Bearer | FILE_SHARE_READ |
| `GET` | `/v1/admin/file-shares-requests/:id` | 요청 상세 조회 | Bearer | FILE_SHARE_READ |
| `POST` | `/v1/admin/file-shares-requests/:id/approve` | 단건 승인 | Bearer | FILE_SHARE_APPROVE |
| `POST` | `/v1/admin/file-shares-requests/:id/reject` | 단건 반려 | Bearer | FILE_SHARE_APPROVE |
| `POST` | `/v1/admin/file-shares-requests/bulk-approve` | 일괄 승인 | Bearer | FILE_SHARE_APPROVE |
| `POST` | `/v1/admin/file-shares-requests/bulk-reject` | 일괄 반려 | Bearer | FILE_SHARE_APPROVE |
| `GET` | `/v1/admin/file-shares-requests/by-target/:userId` | 대상자별 공유 조회 | Bearer | FILE_SHARE_READ |
| `GET` | `/v1/admin/file-shares-requests/by-file/:fileId` | 파일별 공유 조회 | Bearer | FILE_SHARE_READ |
| `GET` | `/v1/admin/file-shares-requests/files` | 파일별 전체 목록 조회 | Bearer | FILE_SHARE_READ |
| `GET` | `/v1/admin/file-shares-requests/targets` | 대상자별 전체 목록 조회 | Bearer | FILE_SHARE_READ |

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
> 관리자 권한 (`FILE_SHARE_READ`, `FILE_SHARE_APPROVE`)이 필요합니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/share-request-admin.ts

// ─── Enum 타입 ───

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 사용자 타입 */
export type UserType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 항목 출처 (Q-1, Q-2 응답에서 사용) */
export type ShareItemSource = 'ACTIVE_SHARE' | 'PENDING_REQUEST';

// ─── 공통 타입 ───

/** 내부 사용자 상세 정보 */
export interface InternalUserDetail {
  /** 사용자 구분 */
  type: 'INTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 부서 */
  department: string;
  /** 직급 */
  position?: string;
}

/** 외부 사용자 상세 정보 */
export interface ExternalUserDetail {
  /** 사용자 구분 */
  type: 'EXTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 회사 */
  company?: string;
  /** 소속 부서 */
  department?: string;
  /** 연락처 */
  phone?: string;
}

/** 사용자 상세 정보 (내부 또는 외부) */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

/** 파일 상세 정보 */
export interface FileDetail {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 */
  name: string;
  /** MIME 타입 */
  mimeType: string;
  /** 파일 크기 (바이트) */
  sizeBytes: number;
}

/** 권한 정보 */
export interface Permission {
  /** 권한 타입: VIEW(열람만) | DOWNLOAD(다운로드 허용) */
  type: 'VIEW' | 'DOWNLOAD';
  /** 최대 다운로드 허용 횟수 */
  maxDownloads?: number;
}

/** 공유 대상 */
export interface ShareTarget {
  /** 대상 타입 */
  type: UserType;
  /** 사용자 ID (UUID) */
  userId: string;
}

/** 대상 사용자 상세 정보 포함 */
export interface EnrichedShareTarget {
  type: UserType;
  userId: string;
  userDetail?: UserDetail;
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

// ─── A-1: 상태별 카운트 ───

export interface ShareRequestSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
}

// ─── A-2: 요청 목록 / A-3: 요청 상세 / A-4,5: 단건 승인·반려 응답 ───

export interface ShareRequestResponse {
  /** 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: ShareRequestStatus;
  /** 공유할 파일 ID 목록 */
  fileIds: string[];
  /** 파일 상세 정보 (enriched) */
  files?: FileDetail[];
  /** 요청자 ID (UUID) */
  requesterId: string;
  /** 요청자 상세 정보 (enriched) */
  requesterDetail?: InternalUserDetail;
  /** 공유 대상 */
  targets: ShareTarget[];
  /** 대상 상세 정보 (enriched) */
  targetDetails?: EnrichedShareTarget[];
  /** 권한 */
  permission: Permission;
  /** 공유 시작일 (ISO 8601) */
  startAt: string;
  /** 공유 종료일 (ISO 8601) */
  endAt: string;
  /** 요청 사유 */
  reason: string;
  /** 지정 승인자 ID (UUID) */
  designatedApproverId: string;
  /** 지정 승인자 상세 (enriched) */
  designatedApproverDetail?: InternalUserDetail;
  /** 실제 처리자 ID (UUID) */
  approverId?: string;
  /** 실제 처리자 상세 (enriched) */
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
  /** 수정일시 (ISO 8601) */
  updatedAt?: string;
}

// ─── A-3: 상세 조회 응답 (A-2와 동일 구조) ───

export type ShareRequestAdminDetail = ShareRequestResponse;

// ─── A-6, A-7: 일괄 결정 응답 ───

export interface BulkDecisionResponse {
  /** 처리된 요청 수 */
  processedCount: number;
  /** 항목별 결과 */
  items: Array<{
    /** 요청 ID (UUID) */
    id: string;
    /** 처리 성공 여부 */
    success: boolean;
    /** 에러 메시지 (실패 시) */
    error?: string;
  }>;
}

// ─── Q-1, Q-2: 공유 항목 ───

/** 공유 항목 (활성 공유 또는 대기 요청) */
export interface ShareItem {
  /** 출처: 활성 공유 또는 대기 요청 */
  source: ShareItemSource;

  /** 파일 정보 */
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };

  /** 요청자 정보 */
  requester: InternalUserDetail;
  /** 대상자 정보 */
  target: UserDetail;
  /** 승인자 정보 (결정 완료 시) */
  approver?: InternalUserDetail;

  /** 자동 승인 여부 */
  isAutoApproved?: boolean;
  /** 결정일시 (ISO 8601) */
  decidedAt?: string;
  /** 결정 코멘트 */
  decisionComment?: string;
  /** 요청 사유 */
  reason: string;
  /** 권한: VIEW | DOWNLOAD */
  permission: string;
  /** 공유 시작일 (ISO 8601) */
  startAt: string;
  /** 공유 종료일 (ISO 8601) */
  endAt: string;

  // ── ACTIVE_SHARE 전용 ──
  /** 공유 링크 ID (UUID) */
  publicShareId?: string;
  /** 조회 수 */
  currentViewCount?: number;
  /** 다운로드 수 */
  currentDownloadCount?: number;
  /** 차단 여부 */
  isBlocked?: boolean;
  /** 공유 활성화 일시 (ISO 8601) */
  sharedAt?: string;

  // ── PENDING_REQUEST 전용 ──
  /** 요청 ID (UUID) */
  shareRequestId?: string;
  /** 요청 접수일 (ISO 8601) */
  requestedAt?: string;
}

/** 공유 현황 요약 */
export interface ShareSummary {
  activeShareCount: number;
  pendingRequestCount: number;
  totalViewCount: number;
  totalDownloadCount: number;
}

// ─── Q-1: 대상자별 조회 응답 ───

export interface SharesByTargetResponse extends PaginatedResponse<ShareItem> {
  target: UserDetail;
  summary: ShareSummary;
}

// ─── Q-2: 파일별 조회 응답 ───

export interface SharesByFileResponse extends PaginatedResponse<ShareItem> {
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  summary: ShareSummary;
}

// ─── Q-3, Q-4: 그룹 목록 ───

/** 요청 간략 정보 */
export interface ShareRequestBrief {
  id: string;
  status: ShareRequestStatus;
  requester: InternalUserDetail;
  targets: UserDetail[];
  permission: string;
  maxDownloads?: number;
  currentDownloadCount?: number;
  currentViewCount?: number;
  startAt: string;
  endAt: string;
  requestedAt: string;
  reason: string;
  approver?: InternalUserDetail;
  decidedAt?: string;
}

/** 그룹 요약 통계 */
export interface GroupSummary {
  totalRequestCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  canceledCount: number;
  activeShareCount: number;
}

// ─── Q-3: 파일별 그룹 ───

export interface FileGroupItem {
  file: { id: string; name: string; path: string; mimeType: string };
  summary: GroupSummary;
  latestRequestedAt: string;
  requests: ShareRequestBrief[];
}

export type FileGroupListResponse = PaginatedResponse<FileGroupItem>;

// ─── Q-4: 대상자별 그룹 ───

export interface TargetGroupItem {
  target: UserDetail;
  summary: GroupSummary;
  latestRequestedAt: string;
  requests: ShareRequestBrief[];
}

export type TargetGroupListResponse = PaginatedResponse<TargetGroupItem>;

// ─── 요청 타입 ───

/** 승인 요청 (A-4) */
export interface ApproveRequest {
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** 반려 요청 (A-5) */
export interface RejectRequest {
  /** 반려 코멘트 (필수) */
  comment: string;
}

/** 일괄 승인 요청 (A-6) */
export interface BulkApproveRequest {
  /** 승인할 요청 ID 목록 (UUID[]) */
  ids: string[];
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** 일괄 반려 요청 (A-7) */
export interface BulkRejectRequest {
  /** 반려할 요청 ID 목록 (UUID[]) */
  ids: string[];
  /** 반려 코멘트 (필수) */
  comment: string;
}
```

---

## 4. A-1: 상태별 카운트 조회

공유 요청의 상태별 개수를 조회합니다. 대시보드 상단 요약 카드에 사용합니다.

### 요청

```
GET /v1/admin/file-shares-requests/summary
```

> 파라미터 없음

### 응답 예시

```json
{
  "PENDING": 5,
  "APPROVED": 10,
  "REJECTED": 2,
  "CANCELED": 1
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
const response = await fetch('/v1/admin/file-shares-requests/summary', {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: ShareRequestSummary = await response.json();
// data.PENDING → 대기 중 배지 숫자
```

---

## 5. A-2: 요청 목록 조회

공유 요청 목록을 필터링 + 페이지네이션으로 조회합니다. 각 항목에 파일/사용자 상세 정보가 포함됩니다.

### 요청

```
GET /v1/admin/file-shares-requests
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | **O** | - | 요청 상태 필터 |
| `q` | `string` | X | - | 검색어 (파일명, 요청자명, 대상자명) |
| `requesterId` | `string (UUID)` | X | - | 요청자 ID 필터 |
| `fileId` | `string (UUID)` | X | - | 파일 ID 필터 |
| `targetUserId` | `string (UUID)` | X | - | 대상 사용자 ID 필터 |
| `requestedFrom` | `string (ISO 8601)` | X | - | 요청일 시작 |
| `requestedTo` | `string (ISO 8601)` | X | - | 요청일 종료 |
| `periodFrom` | `string (ISO 8601)` | X | - | 공유 기간 시작 |
| `periodTo` | `string (ISO 8601)` | X | - | 공유 기간 종료 |
| `sort` | `string` | X | `requestedAt,desc` | 정렬 (예: `"requestedAt,desc"`) |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (최대 100) |
| `sortBy` | `string` | X | - | 정렬 기준 필드 |
| `sortOrder` | `asc \| desc` | X | `desc` | 정렬 순서 |

> **주의:** `status`는 필수 파라미터입니다.

### 응답 예시

```json
{
  "items": [
    {
      "id": "69a1cd7f-985f-4425-a772-b83ba008b9f1",
      "status": "APPROVED",
      "fileIds": ["3f76aded-73e3-4e71-9f2f-c39f3720d007"],
      "files": [
        {
          "id": "3f76aded-73e3-4e71-9f2f-c39f3720d007",
          "name": "보고서.pdf",
          "mimeType": "application/pdf",
          "sizeBytes": 1048576
        }
      ],
      "requesterId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "requesterDetail": {
        "type": "INTERNAL_USER",
        "userId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "targets": [
        { "type": "EXTERNAL_USER", "userId": "9535e410-3000-4d93-846c-5a85dd39fb3d" }
      ],
      "targetDetails": [
        {
          "type": "EXTERNAL_USER",
          "userId": "9535e410-3000-4d93-846c-5a85dd39fb3d",
          "userDetail": {
            "type": "INTERNAL_USER",
            "userId": "9535e410-3000-4d93-846c-5a85dd39fb3d",
            "name": "김철수",
            "email": "kim@partner.com",
            "department": ""
          }
        }
      ],
      "permission": { "type": "DOWNLOAD", "maxDownloads": 3 },
      "startAt": "2026-02-12T00:00:00.000Z",
      "endAt": "2026-03-12T00:00:00.000Z",
      "reason": "프로젝트 협업을 위한 파일 공유",
      "designatedApproverId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "designatedApproverDetail": {
        "type": "INTERNAL_USER",
        "userId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "approverId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "approverDetail": {
        "type": "INTERNAL_USER",
        "userId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "decidedAt": "2026-02-12T09:35:42.587Z",
      "decisionComment": "자동 승인 (FILE_SHARE_DIRECT 권한)",
      "isAutoApproved": true,
      "publicShareIds": ["ac6cde7b-78c4-4eb0-8f58-cf5fc45600ad"],
      "requestedAt": "2026-02-12T09:35:42.586Z"
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

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | status 누락 또는 잘못된 값 | 쿼리 파라미터 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
const params = new URLSearchParams({
  status: 'PENDING',
  page: '1',
  pageSize: '20',
});

const response = await fetch(`/v1/admin/file-shares-requests?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: PaginatedResponse<ShareRequestResponse> = await response.json();
```

---

## 6. A-3: 요청 상세 조회

특정 공유 요청의 상세 정보를 조회합니다. 파일/사용자 상세 정보가 포함됩니다.

### 요청

```
GET /v1/admin/file-shares-requests/:id
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 요청 ID | `69a1cd7f-985f-4425-a772-b83ba008b9f1` |

### 응답 예시

> A-2 응답의 `items[0]`과 동일한 구조입니다. (단일 객체)

```json
{
  "id": "69a1cd7f-985f-4425-a772-b83ba008b9f1",
  "status": "PENDING",
  "fileIds": ["3f76aded-73e3-4e71-9f2f-c39f3720d007"],
  "files": [{ "id": "3f76aded-...", "name": "보고서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }],
  "requesterId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
  "requesterDetail": { "type": "INTERNAL_USER", "userId": "f5d3b1c3-...", "name": "홍길동", "email": "hong@company.com", "department": "개발팀" },
  "targets": [{ "type": "EXTERNAL_USER", "userId": "9535e410-..." }],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 3 },
  "startAt": "2026-02-12T00:00:00.000Z",
  "endAt": "2026-03-12T00:00:00.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "f5d3b1c3-...",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-12T09:35:42.586Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const requestId = '69a1cd7f-985f-4425-a772-b83ba008b9f1';

const response = await fetch(`/v1/admin/file-shares-requests/${requestId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: ShareRequestAdminDetail = await response.json();
```

---

## 7. A-4: 단건 승인

PENDING 상태의 공유 요청을 승인합니다. 승인 시 PublicShare가 생성되어 파일 공유가 활성화됩니다.

### 요청

```
POST /v1/admin/file-shares-requests/:id/approve
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `string (UUID)` | 승인할 요청 ID |

#### Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `comment` | `string` | X | 승인 코멘트 | `"승인합니다."` |

### 요청 예시

```json
{
  "comment": "승인합니다."
}
```

### 응답 예시

> `ShareRequestResponse` 구조 (상태가 `APPROVED`로 변경됨)

```json
{
  "id": "69a1cd7f-985f-4425-a772-b83ba008b9f1",
  "status": "APPROVED",
  "decidedAt": "2026-02-12T10:00:00.000Z",
  "decisionComment": "승인합니다.",
  "approverId": "f5d3b1c3-...",
  "publicShareIds": ["ac6cde7b-78c4-4eb0-8f58-cf5fc45600ad"],
  "...": "기타 필드 동일"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | PENDING이 아닌 상태이거나 중복 요청 | 상태 확인 후 재시도 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | FILE_SHARE_APPROVE 권한 필요 | 권한 확인 |
| `404` | 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const requestId = '69a1cd7f-985f-4425-a772-b83ba008b9f1';

const response = await fetch(`/v1/admin/file-shares-requests/${requestId}/approve`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ comment: '승인합니다.' }),
});

const data: ShareRequestResponse = await response.json();
```

---

## 8. A-5: 단건 반려

PENDING 상태의 공유 요청을 반려합니다. **반려 코멘트는 필수**입니다.

### 요청

```
POST /v1/admin/file-shares-requests/:id/reject
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `string (UUID)` | 반려할 요청 ID |

#### Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `comment` | `string` | **O** | 반려 사유 | `"보안 정책에 위배됩니다."` |

### 요청 예시

```json
{
  "comment": "보안 정책에 위배됩니다."
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | PENDING이 아닌 상태 또는 코멘트 누락 | 입력값 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | FILE_SHARE_APPROVE 권한 필요 | 권한 확인 |
| `404` | 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const requestId = '69a1cd7f-985f-4425-a772-b83ba008b9f1';

const response = await fetch(`/v1/admin/file-shares-requests/${requestId}/reject`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ comment: '보안 정책에 위배됩니다.' }),
});

const data: ShareRequestResponse = await response.json();
```

---

## 9. A-6: 일괄 승인

여러 공유 요청을 한 번에 승인합니다.

### 요청

```
POST /v1/admin/file-shares-requests/bulk-approve
```

#### Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `ids` | `string[]` | **O** | 승인할 요청 ID 목록 (최소 1개) | `["550e8400-...", "661f9500-..."]` |
| `comment` | `string` | X | 승인 코멘트 | `"일괄 승인합니다."` |

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

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | ids 배열 비어있음 또는 중복 요청 | 입력값 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | FILE_SHARE_APPROVE 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
const response = await fetch('/v1/admin/file-shares-requests/bulk-approve', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ids: ['550e8400-...', '661f9500-...'],
    comment: '일괄 승인합니다.',
  }),
});

const data: BulkDecisionResponse = await response.json();
// data.processedCount → 처리 완료 건수
```

---

## 10. A-7: 일괄 반려

여러 공유 요청을 한 번에 반려합니다. **반려 코멘트는 필수**입니다.

### 요청

```
POST /v1/admin/file-shares-requests/bulk-reject
```

#### Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `ids` | `string[]` | **O** | 반려할 요청 ID 목록 (최소 1개) | `["550e8400-...", "661f9500-..."]` |
| `comment` | `string` | **O** | 반려 사유 | `"보안 정책 위배로 일괄 반려합니다."` |

### 요청 예시

```json
{
  "ids": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "comment": "보안 정책 위배로 일괄 반려합니다."
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
const response = await fetch('/v1/admin/file-shares-requests/bulk-reject', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ids: ['550e8400-...', '661f9500-...'],
    comment: '보안 정책 위배로 일괄 반려합니다.',
  }),
});

const data: BulkDecisionResponse = await response.json();
```

---

## 11. Q-1: 대상자별 공유 조회

특정 사용자에게 공유된 파일 목록을 조회합니다. 활성 공유(PublicShare)와 대기 중 요청(ShareRequest)을 모두 포함합니다.

### 요청

```
GET /v1/admin/file-shares-requests/by-target/:userId
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `userId` | `string (UUID)` | 대상 사용자 ID | `9535e410-3000-4d93-846c-5a85dd39fb3d` |

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (최대 100) |

> **참고:** `status` 파라미터는 불필요합니다. 내부적으로 활성 공유 + PENDING 요청을 모두 자동 조회합니다.

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": {
        "id": "3f76aded-73e3-4e71-9f2f-c39f3720d007",
        "name": "보고서.pdf",
        "path": "0757c603-8f72-4c34-80a2-246c7172de60",
        "mimeType": "application/pdf"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "f5d3b1c3-...",
        "name": "홍길동",
        "email": "hong@company.com",
        "department": "개발팀"
      },
      "target": {
        "type": "INTERNAL_USER",
        "userId": "9535e410-...",
        "name": "김철수",
        "email": "kim@partner.com",
        "department": ""
      },
      "permission": "DOWNLOAD",
      "startAt": "2026-02-12T00:35:00.000Z",
      "endAt": "2026-03-12T00:35:00.000Z",
      "reason": "",
      "publicShareId": "ac6cde7b-78c4-4eb0-8f58-cf5fc45600ad",
      "currentViewCount": 5,
      "currentDownloadCount": 2,
      "isBlocked": false,
      "sharedAt": "2026-02-12T09:35:42.587Z"
    },
    {
      "source": "PENDING_REQUEST",
      "file": {
        "id": "aaa11111-...",
        "name": "계약서.docx",
        "path": "folder-id",
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      "requester": { "type": "INTERNAL_USER", "userId": "...", "name": "박영희", "email": "park@company.com", "department": "법무팀" },
      "target": { "type": "INTERNAL_USER", "userId": "9535e410-...", "name": "김철수", "email": "kim@partner.com", "department": "" },
      "permission": "VIEW",
      "startAt": "2026-02-15T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "reason": "계약서 검토 요청",
      "shareRequestId": "bbb22222-...",
      "requestedAt": "2026-02-13T14:00:00.000Z"
    }
  ],
  "target": {
    "type": "INTERNAL_USER",
    "userId": "9535e410-3000-4d93-846c-5a85dd39fb3d",
    "name": "김철수",
    "email": "kim@partner.com",
    "department": ""
  },
  "summary": {
    "activeShareCount": 1,
    "pendingRequestCount": 1,
    "totalViewCount": 5,
    "totalDownloadCount": 2
  },
  "page": 1,
  "pageSize": 20,
  "totalItems": 2,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### `source` 필드에 따른 UI 처리

| source | 의미 | UI 표시 | 사용 가능한 전용 필드 |
|--------|------|---------|----------------------|
| `ACTIVE_SHARE` | 현재 활성 공유 | "공유 중" 배지 (녹색) | `publicShareId`, `currentViewCount`, `currentDownloadCount`, `isBlocked`, `sharedAt` |
| `PENDING_REQUEST` | 승인 대기 요청 | "대기 중" 배지 (노란색) | `shareRequestId`, `requestedAt`, `approver`, `decidedAt`, `decisionComment` |

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 사용자를 찾을 수 없음 | userId 확인 |

### fetch 예시

```typescript
const userId = '9535e410-3000-4d93-846c-5a85dd39fb3d';

const params = new URLSearchParams({ page: '1', pageSize: '20' });
const response = await fetch(
  `/v1/admin/file-shares-requests/by-target/${userId}?${params}`,
  { headers: { 'Authorization': `Bearer ${token}` } },
);

const data: SharesByTargetResponse = await response.json();

// 활성 공유와 대기 요청 분리
const activeShares = data.items.filter(item => item.source === 'ACTIVE_SHARE');
const pendingRequests = data.items.filter(item => item.source === 'PENDING_REQUEST');
```

---

## 12. Q-2: 파일별 공유 조회

특정 파일에 대한 공유 목록을 조회합니다. 활성 공유와 대기 중 요청을 모두 포함합니다.

### 요청

```
GET /v1/admin/file-shares-requests/by-file/:fileId
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `fileId` | `string (UUID)` | 파일 ID | `3f76aded-73e3-4e71-9f2f-c39f3720d007` |

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (최대 100) |

> **참고:** `status` 파라미터는 불필요합니다. 내부적으로 활성 공유 + PENDING 요청을 모두 자동 조회합니다.

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": { "id": "3f76aded-...", "name": "111.txt", "path": "0757c603-...", "mimeType": "text/plain" },
      "requester": { "type": "INTERNAL_USER", "userId": "f5d3b1c3-...", "name": "홍길동", "email": "hong@company.com", "department": "개발팀" },
      "target": { "type": "INTERNAL_USER", "userId": "9535e410-...", "name": "김철수", "email": "kim@partner.com", "department": "" },
      "permission": "DOWNLOAD",
      "startAt": "2026-02-12T00:35:00.000Z",
      "endAt": "2026-03-12T00:35:00.000Z",
      "reason": "",
      "publicShareId": "ac6cde7b-...",
      "currentViewCount": 0,
      "currentDownloadCount": 1,
      "isBlocked": false,
      "sharedAt": "2026-02-12T09:35:42.587Z"
    }
  ],
  "file": {
    "id": "3f76aded-73e3-4e71-9f2f-c39f3720d007",
    "name": "111.txt",
    "path": "0757c603-8f72-4c34-80a2-246c7172de60",
    "mimeType": "text/plain"
  },
  "summary": {
    "activeShareCount": 1,
    "pendingRequestCount": 0,
    "totalViewCount": 0,
    "totalDownloadCount": 1
  },
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 파일을 찾을 수 없음 | fileId 확인 |

### fetch 예시

```typescript
const fileId = '3f76aded-73e3-4e71-9f2f-c39f3720d007';

const params = new URLSearchParams({ page: '1', pageSize: '20' });
const response = await fetch(
  `/v1/admin/file-shares-requests/by-file/${fileId}?${params}`,
  { headers: { 'Authorization': `Bearer ${token}` } },
);

const data: SharesByFileResponse = await response.json();
```

---

## 13. Q-3: 파일별 전체 목록 조회

모든 공유 요청을 파일 기준으로 그룹핑하여 조회합니다. 각 파일 하위에 관련 요청 목록과 상태별 요약 통계가 포함됩니다.

### 요청

```
GET /v1/admin/file-shares-requests/files
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | X | 전체 | 상태 필터 |
| `q` | `string` | X | - | 파일명 검색어 |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |
| `sortBy` | `string` | X | `latestRequestedAt` | 정렬 기준: `latestRequestedAt`, `fileName`, `requestCount` |
| `sortOrder` | `asc \| desc` | X | `desc` | 정렬 순서 |

### 응답 예시

```json
{
  "items": [
    {
      "file": {
        "id": "3f76aded-...",
        "name": "보고서.pdf",
        "path": "",
        "mimeType": "application/pdf"
      },
      "summary": {
        "totalRequestCount": 3,
        "pendingCount": 1,
        "approvedCount": 2,
        "rejectedCount": 0,
        "canceledCount": 0,
        "activeShareCount": 2
      },
      "latestRequestedAt": "2026-02-12T09:35:42.586Z",
      "requests": [
        {
          "id": "69a1cd7f-...",
          "status": "APPROVED",
          "requester": { "type": "INTERNAL_USER", "userId": "f5d3b1c3-...", "name": "홍길동", "email": "hong@company.com", "department": "개발팀" },
          "targets": [{ "type": "INTERNAL_USER", "userId": "9535e410-...", "name": "김철수", "email": "kim@partner.com", "department": "" }],
          "permission": "DOWNLOAD",
          "maxDownloads": 3,
          "currentDownloadCount": 1,
          "currentViewCount": 0,
          "startAt": "2026-02-12T00:35:00.000Z",
          "endAt": "2026-03-12T00:35:00.000Z",
          "requestedAt": "2026-02-12T09:35:42.586Z",
          "reason": "프로젝트 협업",
          "approver": { "type": "INTERNAL_USER", "userId": "f5d3b1c3-...", "name": "홍길동", "email": "hong@company.com", "department": "개발팀" },
          "decidedAt": "2026-02-12T09:35:42.587Z"
        }
      ]
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

### fetch 예시

```typescript
const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  sortBy: 'latestRequestedAt',
  sortOrder: 'desc',
});

const response = await fetch(
  `/v1/admin/file-shares-requests/files?${params}`,
  { headers: { 'Authorization': `Bearer ${token}` } },
);

const data: FileGroupListResponse = await response.json();
```

---

## 14. Q-4: 대상자별 전체 목록 조회

모든 공유 요청을 대상자 기준으로 그룹핑하여 조회합니다.

### 요청

```
GET /v1/admin/file-shares-requests/targets
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `ShareRequestStatus` | X | 전체 | 상태 필터 |
| `q` | `string` | X | - | 대상자 이름/이메일 검색어 |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |
| `sortBy` | `string` | X | `latestRequestedAt` | 정렬 기준: `latestRequestedAt`, `targetName`, `requestCount` |
| `sortOrder` | `asc \| desc` | X | `desc` | 정렬 순서 |

### 응답 예시

```json
{
  "items": [
    {
      "target": {
        "type": "INTERNAL_USER",
        "userId": "9535e410-...",
        "name": "김철수",
        "email": "kim@partner.com",
        "department": ""
      },
      "summary": {
        "totalRequestCount": 2,
        "pendingCount": 0,
        "approvedCount": 2,
        "rejectedCount": 0,
        "canceledCount": 0,
        "activeShareCount": 1
      },
      "latestRequestedAt": "2026-02-12T09:35:42.586Z",
      "requests": [
        {
          "id": "69a1cd7f-...",
          "status": "APPROVED",
          "requester": { "type": "INTERNAL_USER", "userId": "f5d3b1c3-...", "name": "홍길동", "email": "hong@company.com", "department": "개발팀" },
          "targets": [{ "type": "INTERNAL_USER", "userId": "9535e410-...", "name": "김철수", "email": "kim@partner.com", "department": "" }],
          "permission": "DOWNLOAD",
          "startAt": "2026-02-12T00:35:00.000Z",
          "endAt": "2026-03-12T00:35:00.000Z",
          "requestedAt": "2026-02-12T09:35:42.586Z",
          "reason": "프로젝트 협업"
        }
      ]
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

### fetch 예시

```typescript
const params = new URLSearchParams({
  q: '김철수',
  page: '1',
  pageSize: '20',
});

const response = await fetch(
  `/v1/admin/file-shares-requests/targets?${params}`,
  { headers: { 'Authorization': `Bearer ${token}` } },
);

const data: TargetGroupListResponse = await response.json();
```

---

## 15. Enum 값 정리

### ShareRequestStatus

| 값 | 설명 | UI 표시 (제안) | 배지 색상 |
|----|------|---------------|-----------|
| `PENDING` | 승인 대기 중 | 대기 | 노란색 / warning |
| `APPROVED` | 승인됨 | 승인 | 녹색 / success |
| `REJECTED` | 반려됨 | 반려 | 빨간색 / error |
| `CANCELED` | 취소됨 | 취소 | 회색 / default |

### UserType

| 값 | 설명 | UI 표시 |
|----|------|---------|
| `INTERNAL_USER` | 내부 사용자 (직원) | 내부 |
| `EXTERNAL_USER` | 외부 사용자 | 외부 |

### ShareItemSource (Q-1, Q-2 응답)

| 값 | 설명 | UI 표시 |
|----|------|---------|
| `ACTIVE_SHARE` | 현재 활성화된 공유 | 공유 중 (녹색) |
| `PENDING_REQUEST` | 승인 대기 중인 요청 | 대기 중 (노란색) |

### Permission Type

| 값 | 설명 | UI 표시 |
|----|------|---------|
| `VIEW` | 열람만 가능 | 열람 |
| `DOWNLOAD` | 다운로드 허용 | 다운로드 |

---

## 16. 에러 처리

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
    "요청 ID는 올바른 UUID 형식이어야 합니다."
  ],
  "error": "Bad Request",
  "timestamp": "2026-02-12T11:21:42.817Z"
}
```

> `message`는 배열로 올 수 있습니다. 각 항목을 필드별로 매핑하여 표시하세요.

### 에러 처리 유틸리티

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
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

// 사용 예시
const summary = await apiRequest<ShareRequestSummary>(
  '/v1/admin/file-shares-requests/summary'
);
```

---

## 17. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@company.com", "password": "password"}' | jq -r '.accessToken')

# A-1: 상태별 카운트
curl http://localhost:3000/v1/admin/file-shares-requests/summary \
  -H "Authorization: Bearer $TOKEN" | jq

# A-2: 목록 조회 (PENDING, 1페이지)
curl "http://localhost:3000/v1/admin/file-shares-requests?status=PENDING&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# A-3: 상세 조회
curl http://localhost:3000/v1/admin/file-shares-requests/69a1cd7f-985f-4425-a772-b83ba008b9f1 \
  -H "Authorization: Bearer $TOKEN" | jq

# A-4: 단건 승인
curl -X POST http://localhost:3000/v1/admin/file-shares-requests/69a1cd7f-985f-4425-a772-b83ba008b9f1/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "승인합니다."}' | jq

# A-5: 단건 반려
curl -X POST http://localhost:3000/v1/admin/file-shares-requests/69a1cd7f-985f-4425-a772-b83ba008b9f1/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "보안 정책에 위배됩니다."}' | jq

# A-6: 일괄 승인
curl -X POST http://localhost:3000/v1/admin/file-shares-requests/bulk-approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["550e8400-e29b-41d4-a716-446655440001"], "comment": "일괄 승인"}' | jq

# A-7: 일괄 반려
curl -X POST http://localhost:3000/v1/admin/file-shares-requests/bulk-reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["550e8400-e29b-41d4-a716-446655440001"], "comment": "일괄 반려 사유"}' | jq

# Q-1: 대상자별 조회
curl "http://localhost:3000/v1/admin/file-shares-requests/by-target/9535e410-3000-4d93-846c-5a85dd39fb3d?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# Q-2: 파일별 조회
curl "http://localhost:3000/v1/admin/file-shares-requests/by-file/3f76aded-73e3-4e71-9f2f-c39f3720d007?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# Q-3: 파일별 전체 목록
curl "http://localhost:3000/v1/admin/file-shares-requests/files?page=1&pageSize=20&sortBy=latestRequestedAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq

# Q-4: 대상자별 전체 목록
curl "http://localhost:3000/v1/admin/file-shares-requests/targets?page=1&pageSize=20&q=김철수" \
  -H "Authorization: Bearer $TOKEN" | jq
```
