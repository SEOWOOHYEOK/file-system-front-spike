# 공유 요청 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `700.공유요청` / `520.관리자-공유요청` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [R-0: 가용성 확인](#4-r-0-가용성-확인)
5. [R-1: 공유 요청 생성](#5-r-1-공유-요청-생성)
6. [R-2: 내 공유 요청 목록](#6-r-2-내-공유-요청-목록)
7. [R-3: 내 공유 요청 상세 조회](#7-r-3-내-공유-요청-상세-조회)
8. [R-4: 내 공유 요청 취소](#8-r-4-내-공유-요청-취소)
9. [A-1: 상태별 카운트 조회](#9-a-1-상태별-카운트-조회)
10. [A-2: 공유 요청 목록 조회](#10-a-2-공유-요청-목록-조회)
11. [A-3: 공유 요청 상세 조회](#11-a-3-공유-요청-상세-조회)
12. [A-4: 단건 승인](#12-a-4-단건-승인)
13. [A-5: 단건 반려](#13-a-5-단건-반려)
14. [A-6: 일괄 승인](#14-a-6-일괄-승인)
15. [A-7: 일괄 반려](#15-a-7-일괄-반려)
16. [Q-1: 대상자별 공유 조회](#16-q-1-대상자별-공유-조회)
17. [Q-2: 파일별 공유 조회](#17-q-2-파일별-공유-조회)
18. [Enum 값 정리](#enum-값-정리)
19. [에러 처리](#에러-처리)
20. [cURL 테스트](#curl-테스트)

---

## 1. API 개요

### 요청자용 API (`700.공유요청`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/v1/share-requests/check-availability` | 공유 요청 가용성 확인 | Bearer |
| `POST` | `/v1/share-requests` | 공유 요청 생성 | Bearer |
| `GET` | `/v1/share-requests/my` | 내 공유 요청 목록 | Bearer |
| `GET` | `/v1/share-requests/my/:id` | 내 공유 요청 상세 조회 | Bearer |
| `POST` | `/v1/share-requests/my/:id/cancel` | 내 공유 요청 취소 | Bearer |

### 관리자용 API (`520.관리자-공유요청`)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/v1/admin/share-requests/summary` | 상태별 카운트 조회 | Bearer |
| `GET` | `/v1/admin/share-requests` | 공유 요청 목록 조회 (필터+페이지네이션) | Bearer |
| `GET` | `/v1/admin/share-requests/:id` | 공유 요청 상세 조회 | Bearer |
| `POST` | `/v1/admin/share-requests/:id/approve` | 단건 승인 | Bearer |
| `POST` | `/v1/admin/share-requests/:id/reject` | 단건 반려 | Bearer |
| `POST` | `/v1/admin/share-requests/bulk-approve` | 일괄 승인 | Bearer |
| `POST` | `/v1/admin/share-requests/bulk-reject` | 일괄 반려 | Bearer |
| `GET` | `/v1/admin/share-requests/by-target/:userId` | 대상자별 공유 조회 | Bearer |
| `GET` | `/v1/admin/share-requests/by-file/:fileId` | 파일별 공유 조회 | Bearer |

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

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/share-request.ts

// ─── Enum 타입 ───

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 가용성 상태 */
export type AvailabilityStatus = 'AVAILABLE' | 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';

/** 공유 항목 출처 */
export type ShareItemSource = 'ACTIVE_SHARE' | 'PENDING_REQUEST';

// ─── 공통 타입 ───

/** 공유 대상 */
export interface ShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
}

/** 권한 */
export interface Permission {
  /** 권한 타입 */
  type: SharePermissionType;
  /** 최대 다운로드 횟수 (DOWNLOAD일 때만, 선택) */
  maxDownloads?: number;
}

/** 내부 사용자 정보 */
export interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  department: string;
  position?: string;
}

/** 외부 사용자 정보 */
export interface ExternalUserDetail {
  type: 'EXTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  company?: string;
  department?: string;
  phone?: string;
}

/** 사용자 정보 (내부 또는 외부) - type 필드로 구분 */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

// ─── 요청 타입 ───

/** POST /v1/share-requests/check-availability 요청 */
export interface CheckAvailabilityRequest {
  /** 확인할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 확인할 공유 대상 목록 */
  targets: ShareTarget[];
}

/** POST /v1/share-requests 요청 */
export interface CreateShareRequestRequest {
  /** 공유할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 부여할 권한 */
  permission: Permission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
}

/** POST /v1/admin/share-requests/:id/approve 요청 */
export interface ApproveRequest {
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** POST /v1/admin/share-requests/:id/reject 요청 */
export interface RejectRequest {
  /** 반려 코멘트 (필수) */
  comment: string;
}

/** POST /v1/admin/share-requests/bulk-approve 요청 */
export interface BulkApproveRequest {
  /** 승인할 요청 ID 목록 (UUID[]) */
  ids: string[];
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** POST /v1/admin/share-requests/bulk-reject 요청 */
export interface BulkRejectRequest {
  /** 반려할 요청 ID 목록 (UUID[]) */
  ids: string[];
  /** 반려 코멘트 (필수) */
  comment: string;
}

// ─── 응답 타입 ───

/** 공유 요청 응답 (공통) */
export interface ShareRequestResponse {
  /** 공유 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: ShareRequestStatus;
  /** 공유할 파일 ID 목록 */
  fileIds: string[];
  /** 요청자 ID (UUID) */
  requesterId: string;
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 부여할 권한 */
  permission: Permission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /** 승인자 ID (UUID, 결정 후 존재) */
  approverId?: string;
  /** 결정일시 (ISO 8601, 결정 후 존재) */
  decidedAt?: string;
  /** 결정 코멘트 (결정 후 존재) */
  decisionComment?: string;
  /** 자동 승인 여부 */
  isAutoApproved: boolean;
  /** 생성된 공유 ID 목록 (승인 후 존재) */
  publicShareIds: string[];
  /** 요청일시 (ISO 8601) */
  requestedAt: string;
}

/** 가용성 확인 결과 항목 */
export interface AvailabilityResultItem {
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 공유 대상 */
  target: ShareTarget;
  /** 대상 사용자 이름 */
  targetName?: string;
  /** 가용성 상태 */
  status: AvailabilityStatus;
  /** 충돌 정보 (충돌 시 존재) */
  conflict?: {
    conflictType: 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';
    fileId: string;
    targetUserId: string;
    publicShareId?: string;
    shareRequestId?: string;
    requestedAt?: string;
    requesterName?: string;
  };
}

/** 가용성 확인 응답 */
export interface CheckAvailabilityResponse {
  /** 전체 가용 여부 (모든 조합이 AVAILABLE이면 true) */
  available: boolean;
  /** 각 (파일, 대상) 조합별 가용성 결과 */
  results: AvailabilityResultItem[];
}

/** 상태별 카운트 요약 응답 */
export interface ShareRequestSummary {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELED: number;
}

/** 관리자용 공유 요청 상세 응답 */
export interface ShareRequestAdminDetail {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  requesterId: string;
  /** 요청자 정보 (내부 사용자) */
  requester?: InternalUserDetail;
  /** 공유 대상 목록 (상세 정보 포함) */
  targets: Array<{
    type: string;
    userId: string;
    userDetail?: UserDetail;
  }>;
  permission: Permission;
  startAt: string;
  endAt: string;
  reason: string;
  approverId?: string;
  /** 승인자 정보 */
  approver?: InternalUserDetail;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
  updatedAt?: string;
}

/** 일괄 결정 응답 항목 */
export interface BulkDecisionItem {
  /** 요청 ID (UUID) */
  id: string;
  /** 처리 성공 여부 */
  success: boolean;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/** 일괄 결정 응답 */
export interface BulkDecisionResponse {
  /** 처리된 요청 수 */
  processedCount: number;
  /** 처리 결과 항목 목록 */
  items: BulkDecisionItem[];
}

/** 공유 항목 (대상자별/파일별 조회용) */
export interface ShareItem {
  /** 데이터 출처: 활성 공유 또는 대기 요청 */
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
  /** 승인자 정보 (결정 후 존재) */
  approver?: InternalUserDetail;
  /** 자동 승인 여부 */
  isAutoApproved?: boolean;
  /** 결정 일시 */
  decidedAt?: string;
  /** 결정 코멘트 */
  decisionComment?: string;
  /** 요청 사유 */
  reason: string;
  /** 권한: 'VIEW' | 'DOWNLOAD' */
  permission: string;
  /** 공유 시작일시 */
  startAt: string;
  /** 공유 만료일시 */
  endAt: string;

  // ── ACTIVE_SHARE 전용 (source === 'ACTIVE_SHARE'일 때) ──
  publicShareId?: string;
  currentViewCount?: number;
  currentDownloadCount?: number;
  isBlocked?: boolean;
  sharedAt?: string;

  // ── PENDING_REQUEST 전용 (source === 'PENDING_REQUEST'일 때) ──
  shareRequestId?: string;
  requestedAt?: string;
}

/** 요약 통계 (대상자별/파일별 공통) */
export interface ShareSummary {
  activeShareCount: number;
  pendingRequestCount: number;
  totalViewCount: number;
  totalDownloadCount: number;
}

/** 대상자별 공유 조회 응답 */
export interface SharesByTargetResponse extends PaginatedResponse<ShareItem> {
  /** 대상 사용자 정보 */
  target: UserDetail;
  /** 요약 통계 */
  summary: ShareSummary;
}

/** 파일별 공유 조회 응답 */
export interface SharesByFileResponse extends PaginatedResponse<ShareItem> {
  /** 파일 정보 */
  file: {
    id: string;
    name: string;
    path: string;
    mimeType: string;
  };
  /** 요약 통계 */
  summary: ShareSummary;
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

## 4. R-0: 가용성 확인

공유 요청 전에 파일+대상 조합의 가용성을 사전 확인합니다. 이미 활성 공유가 있거나 대기 중인 요청이 있는지 검사합니다.

### 요청

```
POST /v1/share-requests/check-availability
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `fileIds` | `string[]` | O | 확인할 파일 ID 목록 (UUID) | `["550e8400-..."]` |
| `targets` | `ShareTarget[]` | O | 확인할 공유 대상 목록 | 아래 참조 |
| `targets[].type` | `string` | O | 대상 타입 | `"INTERNAL_USER"` |
| `targets[].userId` | `string` | O | 사용자 ID (UUID) | `"550e8400-..."` |

### 요청 예시

```json
{
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "targets": [
    {
      "type": "EXTERNAL_USER",
      "userId": "660e8400-e29b-41d4-a716-446655440010"
    }
  ]
}
```

### 응답 예시

```json
{
  "available": false,
  "results": [
    {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "프로젝트_계획서.pdf",
      "target": {
        "type": "EXTERNAL_USER",
        "userId": "660e8400-e29b-41d4-a716-446655440010"
      },
      "targetName": "김외부",
      "status": "ACTIVE_SHARE_EXISTS",
      "conflict": {
        "conflictType": "ACTIVE_SHARE_EXISTS",
        "fileId": "550e8400-e29b-41d4-a716-446655440001",
        "targetUserId": "660e8400-e29b-41d4-a716-446655440010",
        "publicShareId": "770e8400-e29b-41d4-a716-446655440020"
      }
    }
  ]
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 필수 필드 누락 또는 유효성 검증 실패 | 입력값 검증 |
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
const response = await fetch('/v1/share-requests/check-availability', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileIds: ['550e8400-e29b-41d4-a716-446655440001'],
    targets: [
      { type: 'EXTERNAL_USER', userId: '660e8400-e29b-41d4-a716-446655440010' },
    ],
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: CheckAvailabilityResponse = await response.json();

// 가용하지 않은 항목 필터링
const conflicts = data.results.filter(r => r.status !== 'AVAILABLE');
if (conflicts.length > 0) {
  // 충돌 항목 UI에 표시
  conflicts.forEach(c => {
    console.warn(`${c.fileName} → ${c.targetName}: ${c.status}`);
  });
}
```

---

## 5. R-1: 공유 요청 생성

파일 공유를 요청합니다. 권한에 따라 즉시 승인(자동)되거나 대기 상태로 저장됩니다.

- `FILE_SHARE_DIRECT` 권한: 즉시 승인 → PublicShare 생성
- `FILE_SHARE_REQUEST` 권한: PENDING 상태 → 관리자 승인 대기

### 요청

```
POST /v1/share-requests
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `fileIds` | `string[]` | O | 공유할 파일 ID 목록 (UUID) | `["550e8400-..."]` |
| `targets` | `ShareTarget[]` | O | 공유 대상 목록 | 아래 참조 |
| `targets[].type` | `string` | O | 대상 타입 (`INTERNAL_USER` \| `EXTERNAL_USER`) | `"EXTERNAL_USER"` |
| `targets[].userId` | `string` | O | 사용자 ID (UUID) | `"660e8400-..."` |
| `permission` | `Permission` | O | 부여할 권한 | 아래 참조 |
| `permission.type` | `string` | O | 권한 타입 (`VIEW` \| `DOWNLOAD`) | `"VIEW"` |
| `permission.maxDownloads` | `number` | X | 최대 다운로드 횟수 (DOWNLOAD 시, ≥ 1) | `5` |
| `startAt` | `string` | O | 공유 시작일시 (ISO 8601) | `"2026-02-10T00:00:00.000Z"` |
| `endAt` | `string` | O | 공유 종료일시 (ISO 8601) | `"2026-02-28T23:59:59.000Z"` |
| `reason` | `string` | O | 공유 요청 사유 | `"프로젝트 협업을 위한 파일 공유"` |

### 요청 예시

```json
{
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "targets": [
    {
      "type": "EXTERNAL_USER",
      "userId": "660e8400-e29b-41d4-a716-446655440010"
    }
  ],
  "permission": {
    "type": "DOWNLOAD",
    "maxDownloads": 5
  },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유"
}
```

### 응답 예시

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "PENDING",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "targets": [
    {
      "type": "EXTERNAL_USER",
      "userId": "660e8400-e29b-41d4-a716-446655440010"
    }
  ],
  "permission": {
    "type": "DOWNLOAD",
    "maxDownloads": 5
  },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

> 자동 승인된 경우 `status`가 `"APPROVED"`, `isAutoApproved`가 `true`, `publicShareIds`에 생성된 공유 ID가 포함됩니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 필수 필드 누락, 유효성 검증 실패 | 입력값 재확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 권한 없음 (FILE_SHARE_DIRECT 또는 FILE_SHARE_REQUEST 필요) | 권한 확인 안내 |
| `404` | 파일 또는 대상 사용자를 찾을 수 없음 | ID 확인 |
| `409` | 이미 활성 공유 또는 대기 중인 요청 존재 | 가용성 확인 후 재시도 |

### fetch 예시

```typescript
const response = await fetch('/v1/share-requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileIds: ['550e8400-e29b-41d4-a716-446655440001'],
    targets: [
      { type: 'EXTERNAL_USER', userId: '660e8400-e29b-41d4-a716-446655440010' },
    ],
    permission: { type: 'DOWNLOAD', maxDownloads: 5 },
    startAt: '2026-02-10T00:00:00.000Z',
    endAt: '2026-02-28T23:59:59.000Z',
    reason: '프로젝트 협업을 위한 파일 공유',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestResponse = await response.json();
```

---

## 6. R-2: 내 공유 요청 목록

내가 생성한 공유 요청 목록을 페이지네이션으로 조회합니다.

### 요청

```
GET /v1/share-requests/my
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 (≥ 1) |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | 정렬 순서 (`asc` \| `desc`) |
| `status` | `string` | X | - | 상태 필터 (`PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELED`) |

### 응답 예시

```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440030",
      "status": "PENDING",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "requesterId": "990e8400-e29b-41d4-a716-446655440040",
      "targets": [
        { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
      ],
      "permission": { "type": "VIEW" },
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "reason": "프로젝트 협업을 위한 파일 공유",
      "isAutoApproved": false,
      "publicShareIds": [],
      "requestedAt": "2026-02-09T14:30:00.000Z"
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
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  status: 'PENDING',
});

const response = await fetch(`/v1/share-requests/my?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: PaginatedResponse<ShareRequestResponse> = await response.json();
```

---

## 7. R-3: 내 공유 요청 상세 조회

본인이 요청한 공유 요청의 상세 정보를 조회합니다.

### 요청

```
GET /v1/share-requests/my/:id
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "APPROVED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "approverId": "aa0e8400-e29b-41d4-a716-446655440050",
  "decidedAt": "2026-02-09T16:00:00.000Z",
  "decisionComment": "승인합니다.",
  "isAutoApproved": false,
  "publicShareIds": ["bb0e8400-e29b-41d4-a716-446655440060"],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 본인이 요청한 공유만 조회 가능 | 본인 요청 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/share-requests/my/${requestId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestResponse = await response.json();
```

---

## 8. R-4: 내 공유 요청 취소

본인이 요청한 공유 요청을 취소합니다. **PENDING 상태의 요청만** 취소할 수 있습니다.

### 요청

```
POST /v1/share-requests/my/:id/cancel
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 취소할 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

> Body 없음

### 응답 예시

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "CANCELED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
  ],
  "permission": { "type": "VIEW" },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 취소할 수 없는 상태 (이미 승인/반려/취소됨) | 상태 확인 후 안내 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 본인이 요청한 공유만 취소 가능 | 본인 요청 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/share-requests/my/${requestId}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  if (response.status === 400) {
    // "이미 처리된 요청입니다" 등 안내
  }
  throw new Error(error.message);
}

const data: ShareRequestResponse = await response.json();
```

---

## 9. A-1: 상태별 카운트 조회

관리자가 공유 요청의 상태별 개수를 조회합니다. 대시보드 상단 요약 카드에 사용합니다.

### 요청

```
GET /v1/admin/share-requests/summary
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
const response = await fetch('/v1/admin/share-requests/summary', {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestSummary = await response.json();
// 대시보드 카드에 표시
// data.PENDING → "대기 중: 5건"
```

---

## 10. A-2: 공유 요청 목록 조회

관리자가 공유 요청 목록을 필터링 및 페이지네이션으로 조회합니다.

### 요청

```
GET /v1/admin/share-requests
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `string` | **O** | - | 요청 상태 (`PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELED`) |
| `q` | `string` | X | - | 검색어 (파일명, 요청자명, 대상자명) |
| `requesterId` | `string` | X | - | 요청자 ID (UUID) |
| `fileId` | `string` | X | - | 파일 ID (UUID) |
| `targetUserId` | `string` | X | - | 대상 사용자 ID (UUID) |
| `requestedFrom` | `string` | X | - | 요청일 시작 (ISO 8601) |
| `requestedTo` | `string` | X | - | 요청일 종료 (ISO 8601) |
| `periodFrom` | `string` | X | - | 공유 기간 시작 (ISO 8601) |
| `periodTo` | `string` | X | - | 공유 기간 종료 (ISO 8601) |
| `sort` | `string` | X | `requestedAt,desc` | 정렬 (형식: `"필드명,방향"`) |
| `page` | `number` | X | `1` | 페이지 번호 (≥ 1) |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |

### 응답 예시

```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440030",
      "status": "PENDING",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "requesterId": "990e8400-e29b-41d4-a716-446655440040",
      "targets": [
        { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
      ],
      "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "reason": "프로젝트 협업을 위한 파일 공유",
      "isAutoApproved": false,
      "publicShareIds": [],
      "requestedAt": "2026-02-09T14:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 5,
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

### fetch 예시

```typescript
const params = new URLSearchParams({
  status: 'PENDING',
  page: '1',
  pageSize: '20',
  sort: 'requestedAt,desc',
});

const response = await fetch(`/v1/admin/share-requests?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: PaginatedResponse<ShareRequestResponse> = await response.json();
```

---

## 11. A-3: 공유 요청 상세 조회

관리자가 특정 공유 요청의 상세 정보를 조회합니다. 요청자/승인자/대상자의 상세 사용자 정보가 포함됩니다.

### 요청

```
GET /v1/admin/share-requests/:id
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "PENDING",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "requester": {
    "type": "INTERNAL_USER",
    "userId": "990e8400-e29b-41d4-a716-446655440040",
    "name": "박내부",
    "email": "park@company.com",
    "department": "개발팀",
    "position": "선임"
  },
  "targets": [
    {
      "type": "EXTERNAL_USER",
      "userId": "660e8400-e29b-41d4-a716-446655440010",
      "userDetail": {
        "type": "EXTERNAL_USER",
        "userId": "660e8400-e29b-41d4-a716-446655440010",
        "name": "김외부",
        "email": "kim@partner.com",
        "company": "파트너사",
        "department": "기획팀"
      }
    }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/admin/share-requests/${requestId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestAdminDetail = await response.json();
```

---

## 12. A-4: 단건 승인

특정 공유 요청을 승인합니다. PENDING 상태만 승인 가능하며, 승인 시 PublicShare가 생성됩니다.

### 요청

```
POST /v1/admin/share-requests/:id/approve
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 승인할 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

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

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "APPROVED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "approverId": "aa0e8400-e29b-41d4-a716-446655440050",
  "decidedAt": "2026-02-09T16:00:00.000Z",
  "decisionComment": "승인합니다.",
  "isAutoApproved": false,
  "publicShareIds": ["bb0e8400-e29b-41d4-a716-446655440060"],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 승인할 수 없는 상태이거나 중복 요청 | 상태 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/admin/share-requests/${requestId}/approve`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ comment: '승인합니다.' }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestResponse = await response.json();
```

---

## 13. A-5: 단건 반려

특정 공유 요청을 반려합니다. PENDING 상태만 반려 가능하며, **코멘트는 필수**입니다.

### 요청

```
POST /v1/admin/share-requests/:id/reject
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 반려할 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

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
  "id": "880e8400-e29b-41d4-a716-446655440030",
  "status": "REJECTED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "requesterId": "990e8400-e29b-41d4-a716-446655440040",
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010" }
  ],
  "permission": { "type": "VIEW" },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "approverId": "aa0e8400-e29b-41d4-a716-446655440050",
  "decidedAt": "2026-02-09T16:00:00.000Z",
  "decisionComment": "보안 정책에 위배됩니다.",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-09T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 반려할 수 없는 상태 | 상태 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/admin/share-requests/${requestId}/reject`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ comment: '보안 정책에 위배됩니다.' }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: ShareRequestResponse = await response.json();
```

---

## 14. A-6: 일괄 승인

여러 공유 요청을 한 번에 승인합니다. PENDING 상태의 요청만 승인 가능합니다.

### 요청

```
POST /v1/admin/share-requests/bulk-approve
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `ids` | `string[]` | O | 승인할 요청 ID 목록 (UUID) | `["550e8400-...", "660e8400-..."]` |
| `comment` | `string` | X | 승인 코멘트 | `"일괄 승인합니다."` |

### 요청 예시

```json
{
  "ids": [
    "880e8400-e29b-41d4-a716-446655440030",
    "880e8400-e29b-41d4-a716-446655440031"
  ],
  "comment": "일괄 승인합니다."
}
```

### 응답 예시

```json
{
  "processedCount": 2,
  "items": [
    { "id": "880e8400-e29b-41d4-a716-446655440030", "success": true },
    { "id": "880e8400-e29b-41d4-a716-446655440031", "success": true }
  ]
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 승인할 수 없는 상태이거나 중복 요청 | 상태 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
const response = await fetch('/v1/admin/share-requests/bulk-approve', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ids: ['880e8400-e29b-41d4-a716-446655440030', '880e8400-e29b-41d4-a716-446655440031'],
    comment: '일괄 승인합니다.',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: BulkDecisionResponse = await response.json();
// 실패 항목 확인
const failed = data.items.filter(item => !item.success);
```

---

## 15. A-7: 일괄 반려

여러 공유 요청을 한 번에 반려합니다. PENDING 상태의 요청만 반려 가능하며, **코멘트는 필수**입니다.

### 요청

```
POST /v1/admin/share-requests/bulk-reject
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `ids` | `string[]` | O | 반려할 요청 ID 목록 (UUID) | `["550e8400-...", "660e8400-..."]` |
| `comment` | `string` | **O** | 반려 코멘트 | `"보안 정책에 위배되어 일괄 반려합니다."` |

### 요청 예시

```json
{
  "ids": [
    "880e8400-e29b-41d4-a716-446655440030",
    "880e8400-e29b-41d4-a716-446655440031"
  ],
  "comment": "보안 정책에 위배되어 일괄 반려합니다."
}
```

### 응답 예시

```json
{
  "processedCount": 2,
  "items": [
    { "id": "880e8400-e29b-41d4-a716-446655440030", "success": true },
    { "id": "880e8400-e29b-41d4-a716-446655440031", "success": true }
  ]
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 반려할 수 없는 상태 | 상태 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
const response = await fetch('/v1/admin/share-requests/bulk-reject', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ids: ['880e8400-e29b-41d4-a716-446655440030', '880e8400-e29b-41d4-a716-446655440031'],
    comment: '보안 정책에 위배되어 일괄 반려합니다.',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: BulkDecisionResponse = await response.json();
```

---

## 16. Q-1: 대상자별 공유 조회

특정 사용자에게 공유된 파일 목록을 조회합니다. 활성 공유와 대기 중 요청을 통합하여 반환합니다.

### 요청

```
GET /v1/admin/share-requests/by-target/:userId
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `userId` | `string (UUID)` | **O** (path) | - | 대상 사용자 ID |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "프로젝트_계획서.pdf",
        "path": "/프로젝트/2026",
        "mimeType": "application/pdf"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "990e8400-e29b-41d4-a716-446655440040",
        "name": "박내부",
        "email": "park@company.com",
        "department": "개발팀",
        "position": "선임"
      },
      "target": {
        "type": "EXTERNAL_USER",
        "userId": "660e8400-e29b-41d4-a716-446655440010",
        "name": "김외부",
        "email": "kim@partner.com",
        "company": "파트너사"
      },
      "approver": {
        "type": "INTERNAL_USER",
        "userId": "aa0e8400-e29b-41d4-a716-446655440050",
        "name": "이관리",
        "email": "lee@company.com",
        "department": "보안팀"
      },
      "isAutoApproved": false,
      "decidedAt": "2026-02-09T16:00:00.000Z",
      "reason": "프로젝트 협업",
      "permission": "DOWNLOAD",
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "publicShareId": "bb0e8400-e29b-41d4-a716-446655440060",
      "currentViewCount": 12,
      "currentDownloadCount": 3,
      "isBlocked": false,
      "sharedAt": "2026-02-10T00:00:00.000Z"
    },
    {
      "source": "PENDING_REQUEST",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "설계서_v2.docx",
        "path": "/프로젝트/2026",
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "990e8400-e29b-41d4-a716-446655440040",
        "name": "박내부",
        "email": "park@company.com",
        "department": "개발팀"
      },
      "target": {
        "type": "EXTERNAL_USER",
        "userId": "660e8400-e29b-41d4-a716-446655440010",
        "name": "김외부",
        "email": "kim@partner.com",
        "company": "파트너사"
      },
      "reason": "추가 문서 공유",
      "permission": "VIEW",
      "startAt": "2026-02-15T00:00:00.000Z",
      "endAt": "2026-03-15T23:59:59.000Z",
      "shareRequestId": "cc0e8400-e29b-41d4-a716-446655440070",
      "requestedAt": "2026-02-09T15:00:00.000Z"
    }
  ],
  "target": {
    "type": "EXTERNAL_USER",
    "userId": "660e8400-e29b-41d4-a716-446655440010",
    "name": "김외부",
    "email": "kim@partner.com",
    "company": "파트너사"
  },
  "summary": {
    "activeShareCount": 1,
    "pendingRequestCount": 1,
    "totalViewCount": 12,
    "totalDownloadCount": 3
  },
  "page": 1,
  "pageSize": 20,
  "totalItems": 2,
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
| `404` | 사용자를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const params = new URLSearchParams({ page: '1', pageSize: '20' });

const response = await fetch(`/v1/admin/share-requests/by-target/${userId}?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: SharesByTargetResponse = await response.json();

// source별 분류
const activeShares = data.items.filter(item => item.source === 'ACTIVE_SHARE');
const pendingRequests = data.items.filter(item => item.source === 'PENDING_REQUEST');
```

---

## 17. Q-2: 파일별 공유 조회

특정 파일에 대한 공유 목록을 조회합니다. 활성 공유와 대기 중 요청을 통합하여 반환합니다.

### 요청

```
GET /v1/admin/share-requests/by-file/:fileId
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `fileId` | `string (UUID)` | **O** (path) | - | 파일 ID |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 |

### 응답 예시

```json
{
  "items": [
    {
      "source": "ACTIVE_SHARE",
      "file": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "프로젝트_계획서.pdf",
        "path": "/프로젝트/2026",
        "mimeType": "application/pdf"
      },
      "requester": {
        "type": "INTERNAL_USER",
        "userId": "990e8400-e29b-41d4-a716-446655440040",
        "name": "박내부",
        "email": "park@company.com",
        "department": "개발팀"
      },
      "target": {
        "type": "EXTERNAL_USER",
        "userId": "660e8400-e29b-41d4-a716-446655440010",
        "name": "김외부",
        "email": "kim@partner.com",
        "company": "파트너사"
      },
      "reason": "프로젝트 협업",
      "permission": "DOWNLOAD",
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "publicShareId": "bb0e8400-e29b-41d4-a716-446655440060",
      "currentViewCount": 12,
      "currentDownloadCount": 3,
      "isBlocked": false,
      "sharedAt": "2026-02-10T00:00:00.000Z"
    }
  ],
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "프로젝트_계획서.pdf",
    "path": "/프로젝트/2026",
    "mimeType": "application/pdf"
  },
  "summary": {
    "activeShareCount": 1,
    "pendingRequestCount": 0,
    "totalViewCount": 12,
    "totalDownloadCount": 3
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
| `404` | 파일을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const params = new URLSearchParams({ page: '1', pageSize: '20' });

const response = await fetch(`/v1/admin/share-requests/by-file/${fileId}?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: SharesByFileResponse = await response.json();
```

---

## Enum 값 정리

### ShareRequestStatus (공유 요청 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|----------------|
| `PENDING` | 승인 대기 중 | 대기 중 |
| `APPROVED` | 승인됨 | 승인 |
| `REJECTED` | 반려됨 | 반려 |
| `CANCELED` | 요청자가 취소 | 취소 |

### ShareTargetType (공유 대상 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|----------------|
| `INTERNAL_USER` | 내부 사용자 (직원) | 내부 |
| `EXTERNAL_USER` | 외부 사용자 (사외) | 외부 |

### SharePermissionType (공유 권한)

| 값 | 설명 | UI 표시 (제안) |
|----|------|----------------|
| `VIEW` | 뷰어에서 파일 보기만 가능 | 열람 |
| `DOWNLOAD` | 파일 다운로드 가능 | 다운로드 |

### AvailabilityStatus (가용성 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|----------------|
| `AVAILABLE` | 공유 가능 | 공유 가능 |
| `ACTIVE_SHARE_EXISTS` | 이미 활성 공유 존재 | 이미 공유됨 |
| `PENDING_REQUEST_EXISTS` | 대기 중인 요청 존재 | 요청 대기 중 |

### ShareItemSource (공유 항목 출처)

| 값 | 설명 | UI 표시 (제안) |
|----|------|----------------|
| `ACTIVE_SHARE` | 활성 공유 | 공유 중 |
| `PENDING_REQUEST` | 승인 대기 요청 | 대기 중 |

---

## 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `201` | 생성 성공 | 정상 처리 + 성공 알림 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `409` | 충돌 (중복 등) | 충돌 상세 정보 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "최소 1개 이상의 파일을 선택해야 합니다.",
    "올바른 파일 ID 형식이 아닙니다.",
    "올바른 시작일시 형식이 아닙니다. (ISO 8601)"
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

## cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "password"}' | jq -r '.accessToken')

# ── 요청자용 API ──

# R-0: 가용성 확인
curl -X POST http://localhost:3000/v1/share-requests/check-availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
    "targets": [{"type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010"}]
  }' | jq

# R-1: 공유 요청 생성
curl -X POST http://localhost:3000/v1/share-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
    "targets": [{"type": "EXTERNAL_USER", "userId": "660e8400-e29b-41d4-a716-446655440010"}],
    "permission": {"type": "DOWNLOAD", "maxDownloads": 5},
    "startAt": "2026-02-10T00:00:00.000Z",
    "endAt": "2026-02-28T23:59:59.000Z",
    "reason": "프로젝트 협업을 위한 파일 공유"
  }' | jq

# R-2: 내 공유 요청 목록 (PENDING 상태만)
curl "http://localhost:3000/v1/share-requests/my?status=PENDING&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# R-3: 내 공유 요청 상세 조회
curl http://localhost:3000/v1/share-requests/my/880e8400-e29b-41d4-a716-446655440030 \
  -H "Authorization: Bearer $TOKEN" | jq

# R-4: 내 공유 요청 취소
curl -X POST http://localhost:3000/v1/share-requests/my/880e8400-e29b-41d4-a716-446655440030/cancel \
  -H "Authorization: Bearer $TOKEN" | jq

# ── 관리자용 API ──

# A-1: 상태별 카운트 조회
curl http://localhost:3000/v1/admin/share-requests/summary \
  -H "Authorization: Bearer $TOKEN" | jq

# A-2: 공유 요청 목록 조회
curl "http://localhost:3000/v1/admin/share-requests?status=PENDING&page=1&pageSize=20&sort=requestedAt,desc" \
  -H "Authorization: Bearer $TOKEN" | jq

# A-3: 공유 요청 상세 조회
curl http://localhost:3000/v1/admin/share-requests/880e8400-e29b-41d4-a716-446655440030 \
  -H "Authorization: Bearer $TOKEN" | jq

# A-4: 단건 승인
curl -X POST http://localhost:3000/v1/admin/share-requests/880e8400-e29b-41d4-a716-446655440030/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "승인합니다."}' | jq

# A-5: 단건 반려
curl -X POST http://localhost:3000/v1/admin/share-requests/880e8400-e29b-41d4-a716-446655440030/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "보안 정책에 위배됩니다."}' | jq

# A-6: 일괄 승인
curl -X POST http://localhost:3000/v1/admin/share-requests/bulk-approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["880e8400-e29b-41d4-a716-446655440030", "880e8400-e29b-41d4-a716-446655440031"],
    "comment": "일괄 승인합니다."
  }' | jq

# A-7: 일괄 반려
curl -X POST http://localhost:3000/v1/admin/share-requests/bulk-reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["880e8400-e29b-41d4-a716-446655440030", "880e8400-e29b-41d4-a716-446655440031"],
    "comment": "보안 정책에 위배되어 일괄 반려합니다."
  }' | jq

# Q-1: 대상자별 공유 조회
curl "http://localhost:3000/v1/admin/share-requests/by-target/660e8400-e29b-41d4-a716-446655440010?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# Q-2: 파일별 공유 조회
curl "http://localhost:3000/v1/admin/share-requests/by-file/550e8400-e29b-41d4-a716-446655440001?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```
