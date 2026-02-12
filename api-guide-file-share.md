# 파일 공유 (600·700·701·702·710) - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `600.나의 권한 조회`, `700.파일 공유 요청 생성`, `701.내가 보낸 파일 공유 관리`, `702.내가 받은 파일 공유 요청 관리`, `710.파일 외부공유 접근` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [600 · 나의 권한 조회](#4-600--나의-권한-조회)
5. [700 · 공유 대상자 조회](#5-700--공유-대상자-조회-내부--외부)
6. [700 · 승인 가능 사용자 검색](#6-700--승인-가능-사용자-검색)
7. [700 · 공유 요청 가용성 확인](#7-700--공유-요청-가용성-확인)
8. [700 · 공유 요청 생성](#8-700--공유-요청-생성)
9. [701 · 내 공유 통합 목록](#9-701--내-공유-통합-목록)
10. [701 · 공유 상세 조회 (PublicShare)](#10-701--공유-상세-조회-publicshare)
11. [701 · 공유 취소/철회](#11-701--공유-취소철회)
12. [702 · 받은 공유 요청 목록](#12-702--받은-공유-요청-목록)
13. [702 · 받은 공유 요청 상세 조회](#13-702--받은-공유-요청-상세-조회)
14. [702 · 받은 공유 요청 승인](#14-702--받은-공유-요청-승인)
15. [702 · 받은 공유 요청 반려](#15-702--받은-공유-요청-반려)
16. [710 · 나에게 공유된 파일 목록](#16-710--나에게-공유된-파일-목록)
17. [710 · 공유 상세 조회 + 콘텐츠 토큰 발급](#17-710--공유-상세-조회--콘텐츠-토큰-발급)
18. [710 · 파일 콘텐츠 (뷰어용)](#18-710--파일-콘텐츠-뷰어용)
19. [710 · 파일 다운로드](#19-710--파일-다운로드)
20. [Enum 값 정리](#20-enum-값-정리)
21. [에러 처리](#21-에러-처리)
22. [프론트엔드 플로우별 처리 가이드](#22-프론트엔드-플로우별-처리-가이드)
23. [cURL 테스트](#23-curl-테스트)

---

## 1. API 개요

### 600. 나의 권한 조회

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/users/me/permissions` | 나의 역할 및 권한 조회 | Bearer | (인증만 필요) |

> **핵심 활용**: 공유 요청 전 `FILE_SHARE_DIRECT` 보유 여부를 확인하여 승인자 선택 UI를 분기합니다.

### 700. 파일 공유 요청 생성

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/file-shares-requests/users` | 공유 대상자 조회 (내부 + 외부) | Bearer | `FILE_SHARE_REQUEST` |
| `GET` | `/v1/file-shares-requests/approvers` | 승인 가능 사용자 검색 | Bearer | `FILE_SHARE_REQUEST` |
| `POST` | `/v1/file-shares-requests/requests/check-availability` | 공유 요청 가용성 확인 | Bearer | `FILE_SHARE_REQUEST` |
| `POST` | `/v1/file-shares-requests/requests` | 공유 요청 생성 | Bearer | `FILE_SHARE_REQUEST` |

### 701. 내가 보낸 파일 공유 관리

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/file-shares-requests` | 내 공유 통합 목록 | Bearer | `FILE_SHARE_READ` |
| `GET` | `/v1/file-shares-requests/:id` | 공유 상세 조회 (PublicShare) | Bearer | `FILE_SHARE_READ` |
| `POST` | `/v1/file-shares-requests/:id/cancel` | 공유 취소/철회 (통합) | Bearer | `FILE_SHARE_REQUEST` |

### 702. 내가 받은 파일 공유 요청 관리

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/file-shares-requests/received` | 받은 공유 요청 목록 | Bearer | `FILE_SHARE_APPROVE` |
| `GET` | `/v1/file-shares-requests/received/:id` | 받은 공유 요청 상세 조회 | Bearer | `FILE_SHARE_APPROVE` |
| `POST` | `/v1/file-shares-requests/received/:id/approve` | 받은 공유 요청 승인 | Bearer | `FILE_SHARE_APPROVE` |
| `POST` | `/v1/file-shares-requests/received/:id/reject` | 받은 공유 요청 반려 | Bearer | `FILE_SHARE_APPROVE` |

### 710. 파일 외부공유 접근

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `GET` | `/v1/file-shares-requests/me` | 나에게 공유된 파일 목록 | Bearer | `EXTERNAL_SHARE_READ` |
| `GET` | `/v1/file-shares-requests/:shareId` | 공유 상세 조회 + 콘텐츠 토큰 발급 | Bearer | `EXTERNAL_SHARE_READ` |
| `GET` | `/v1/file-shares-requests/:shareId/content` | 파일 콘텐츠 (뷰어용) | Bearer | `EXTERNAL_SHARE_VIEW` |
| `GET` | `/v1/file-shares-requests/:shareId/download` | 파일 다운로드 | Bearer | `EXTERNAL_SHARE_DOWNLOAD` |

---

## 2. 인증

### 내부 사용자 (700·701·702)

모든 API는 JWT Bearer Token이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

> 토큰은 로그인 API (`POST /v1/auth/login`)로 발급받습니다.

### 외부 사용자 (710)

외부 사용자 전용 JWT Bearer Token이 필요합니다. 내부 JWT와 외부 JWT 모두 허용됩니다 (UnifiedJwtAuthGuard).

```typescript
const headers = {
  'Authorization': `Bearer ${externalAccessToken}`,
};
```

> 외부 사용자 토큰은 외부 인증 API (`POST /v1/external-auth/login`)로 발급받습니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/file-share.ts

// ─── Enum 타입 ───

/** 공유 대상 유형 */
export type ShareTargetUserType = 'INTERNAL' | 'EXTERNAL';

/** 공유 대상 타입 (요청 생성 시 사용) */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 내가 보낸 공유 통합 상태 (ShareRequest + PublicShare) */
export type MySentShareStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'  // ShareRequest
  | 'ACTIVE' | 'REVOKED';                              // PublicShare

/** 가용성 확인 결과 상태 */
export type AvailabilityStatus = 'AVAILABLE' | 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';

/** 내가 보낸 공유 출처 */
export type MySentShareSource = 'SHARE_REQUEST' | 'PUBLIC_SHARE';

// ─── 공통 타입 ───

/** 공유 대상 */
export interface ShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
}

/** 권한 */
export interface SharePermission {
  /** 권한 타입 */
  type: SharePermissionType;
  /** 최대 다운로드 횟수 (DOWNLOAD 권한일 때, 선택적) */
  maxDownloads?: number;
}

// ─── Enriched 타입 (파일/사용자 상세 정보) ───

/** 파일 상세 정보 */
export interface FileDetail {
  /** 파일 ID (UUID) */
  id: string;
  /** 파일명 (확장자 포함) */
  name: string;
  /** MIME 타입 (예: application/pdf) */
  mimeType: string;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
}

/** 내부 사용자 상세 정보 */
export interface InternalUserDetail {
  /** 사용자 구분 타입 */
  type: 'INTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 부서명 */
  department: string;
  /** 직급/직책 */
  position?: string;
}

/** 외부 사용자 상세 정보 */
export interface ExternalUserDetail {
  /** 사용자 구분 타입 */
  type: 'EXTERNAL_USER';
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 소속 회사명 */
  company?: string;
  /** 소속 부서명 */
  department?: string;
  /** 연락처 */
  phone?: string;
}

/** 사용자 상세 정보 (내부 또는 외부) */
export type UserDetail = InternalUserDetail | ExternalUserDetail;

/** 사용자 상세 정보가 포함된 공유 대상 */
export interface EnrichedShareTarget {
  /** 대상 타입 */
  type: ShareTargetType;
  /** 사용자 ID (UUID) */
  userId: string;
  /** 대상 사용자 상세 정보 */
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

// ─── 600. 나의 권한 ───

/** 개별 권한 항목 */
export interface PermissionItem {
  /** 권한 코드 */
  code: string;
  /** 권한 설명 (한글) */
  description: string;
}

/** 카테고리별 권한 그룹 */
export interface PermissionGroup {
  /** 카테고리명 */
  category: string;
  /** 해당 카테고리의 권한 목록 */
  permissions: PermissionItem[];
}

/** GET /v1/users/me/permissions 응답 */
export interface MyPermissionResponse {
  /** 역할 ID (UUID) */
  roleId: string;
  /** 역할명 (ADMIN, MANAGER, USER, GUEST) */
  roleName: string;
  /** 역할 설명 (한글) */
  roleDescription: string;
  /** 보유 권한 코드 플랫 목록 (권한 체크용) */
  permissions: string[];
  /** 카테고리별 권한 그룹 (UI 표시용) */
  permissionGroups: PermissionGroup[];
}

// ─── 700. 요청 타입 ───

/** POST /v1/file-shares-requests/requests/check-availability 요청 */
export interface CheckAvailabilityRequest {
  /** 확인할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 확인할 공유 대상 목록 */
  targets: ShareTarget[];
}

/** POST /v1/file-shares-requests/requests 요청 */
export interface CreateShareRequestRequest {
  /** 공유할 파일 ID 목록 (UUID[]) */
  fileIds: string[];
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 부여할 권한 */
  permission: SharePermission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /**
   * 승인 대상자 ID (UUID)
   * - FILE_SHARE_DIRECT 권한: 생략 가능 (자동 승인)
   * - FILE_SHARE_REQUEST 권한: 필수
   */
  designatedApproverId?: string;
}

// ─── 702. 요청 타입 ───

/** POST /v1/file-shares-requests/received/:id/approve 요청 */
export interface ApproveReceivedRequestBody {
  /** 승인 코멘트 (선택) */
  comment?: string;
}

/** POST /v1/file-shares-requests/received/:id/reject 요청 */
export interface RejectReceivedRequestBody {
  /** 반려 코멘트 (필수) */
  comment: string;
}

// ─── 700. 응답 타입 ───

/** 공유 대상자 */
export interface ShareTargetUser {
  /** 사용자 ID (UUID) */
  id: string;
  /** 사용자 유형 */
  type: ShareTargetUserType;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 부서명 */
  department: string;
  /** Role 이름 (미부여 시 null) */
  roleName: string | null;
  /** 활성 상태 */
  isActive: boolean;
}

/** 승인자 역할 */
export interface ApproverRole {
  /** 역할 ID (UUID) */
  id: string;
  /** 역할 이름 */
  name: string;
  /** 역할 설명 */
  description: string | null;
}

/** 승인자 응답 */
export interface ApproverResponse {
  /** 사용자 ID (UUID) */
  id: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** 사번 */
  employeeNumber: string;
  /** 부서명 */
  departmentName: string | null;
  /** 직책 */
  positionName: string | null;
  /** 역할 정보 */
  role: ApproverRole;
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
  /** 충돌 정보 (status가 AVAILABLE이 아닌 경우) */
  conflict?: {
    conflictType: 'ACTIVE_SHARE_EXISTS' | 'PENDING_REQUEST_EXISTS';
    fileId: string;
    targetUserId: string;
    publicShareId?: string;
    shareRequestId?: string;
    requestedAt?: string; // ISO 8601
    requesterName?: string;
  };
}

/** POST /v1/file-shares-requests/requests/check-availability 응답 */
export interface CheckAvailabilityResponse {
  /** 전체 가용 여부 (모든 조합이 AVAILABLE이면 true) */
  available: boolean;
  /** 각 (파일, 대상) 조합별 가용성 결과 */
  results: AvailabilityResultItem[];
}

/** 공유 요청 응답 (700·701·702 공통) */
export interface ShareRequestResponse {
  /** 공유 요청 ID (UUID) */
  id: string;
  /** 요청 상태 */
  status: ShareRequestStatus;
  /** 공유할 파일 ID 목록 */
  fileIds: string[];
  /** 공유 파일 상세 정보 목록 (이름, MIME타입, 크기) */
  files?: FileDetail[];
  /** 요청자 ID (UUID) */
  requesterId: string;
  /** 요청자 상세 정보 (이름, 부서, 이메일 등) */
  requesterDetail?: InternalUserDetail;
  /** 공유 대상 목록 */
  targets: ShareTarget[];
  /** 공유 대상 상세 정보 목록 (사용자 이름, 부서, 이메일 등 포함) */
  targetDetails?: EnrichedShareTarget[];
  /** 부여할 권한 */
  permission: SharePermission;
  /** 공유 시작일시 (ISO 8601) */
  startAt: string;
  /** 공유 종료일시 (ISO 8601) */
  endAt: string;
  /** 공유 요청 사유 */
  reason: string;
  /** 지정 승인 대상자 ID (UUID) */
  designatedApproverId: string;
  /** 지정 승인자 상세 정보 (이름, 부서, 이메일 등) */
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

// ─── 701. 응답 타입 ───

/** 내가 보낸 공유 통합 목록 아이템 */
export interface MySentShareItem {
  /** 항목 출처 */
  source: MySentShareSource;
  /** ID (ShareRequest 또는 PublicShare UUID) */
  id: string;
  /** 상태 */
  status: string;
  /** 파일 ID 목록 */
  fileIds: string[];
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 소유자/요청자 ID (UUID) */
  ownerId: string;
}

/** 공유 상세 (PublicShare) */
export interface PublicShareResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 소유자 ID (UUID) */
  ownerId: string;
  /** 외부 사용자 ID (UUID) */
  externalUserId: string;
  /** 권한 목록 */
  permissions: string[];
  /** 최대 뷰 횟수 */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601) */
  expiresAt?: string;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 취소 여부 */
  isRevoked: boolean;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt?: string;
  /** 차단일시 (ISO 8601) */
  blockedAt?: string;
  /** 차단자 ID (UUID) */
  blockedBy?: string;
}

/** 공유 취소(철회) 응답 */
export interface RevokeShareResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 취소 여부 */
  isRevoked: boolean;
}

// ─── 710. 응답 타입 ───

/** 나에게 공유된 파일 목록 아이템 */
export interface MyShareListItem {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 권한 목록 */
  permissions: string[];
  /** 만료일시 (ISO 8601) */
  expiresAt?: string;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
}

/** 공유 상세 정보 (710 전용) */
export interface ShareDetail {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** MIME 타입 */
  mimeType: string;
  /** 권한 목록 */
  permissions: string[];
  /** 최대 뷰 횟수 */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601) */
  expiresAt?: string;
}

/** 공유 상세 조회 + 콘텐츠 토큰 발급 응답 */
export interface ShareDetailResponse {
  /** 공유 정보 */
  share: ShareDetail;
  /** 파일 접근용 일회성 토큰 */
  contentToken: string;
  /** 콘텐츠 토큰 만료 시간 (ISO 8601) */
  tokenExpiresAt: string;
}
```

---

## 4. 600 · 나의 권한 조회

현재 로그인한 사용자의 역할 및 보유 권한을 조회합니다.
**공유 요청 폼 진입 시 반드시 먼저 호출하여** `FILE_SHARE_DIRECT` 보유 여부를 확인하고, UI를 분기합니다.

### 엔드포인트

```
GET /v1/users/me/permissions
Authorization: Bearer {token}
```

### 응답 예시

```json
{
  "roleId": "550e8400-e29b-41d4-a716-446655440001",
  "roleName": "MANAGER",
  "roleDescription": "매니저",
  "permissions": [
    "FILE_READ", "FILE_WRITE", "FILE_DELETE",
    "FILE_SHARE_CREATE", "FILE_SHARE_READ", "FILE_SHARE_DELETE",
    "FILE_SHARE_DIRECT", "FILE_SHARE_REQUEST", "FILE_SHARE_APPROVE",
    "FOLDER_READ", "FOLDER_WRITE"
  ],
  "permissionGroups": [
    {
      "category": "File Share Management",
      "permissions": [
        { "code": "FILE_SHARE_CREATE", "description": "파일 공유 생성/설정" },
        { "code": "FILE_SHARE_READ", "description": "파일 공유 조회" },
        { "code": "FILE_SHARE_DELETE", "description": "파일 공유 삭제/해제" },
        { "code": "FILE_SHARE_DIRECT", "description": "파일 공유 직접 생성 (자동승인)" },
        { "code": "FILE_SHARE_REQUEST", "description": "파일 공유 요청 (승인 필요)" },
        { "code": "FILE_SHARE_APPROVE", "description": "외부 공유 요청 승인/반려" }
      ]
    }
  ]
}
```

### fetch 코드

```typescript
async function getMyPermissions(token: string): Promise<MyPermissionResponse> {
  const response = await fetch('/v1/users/me/permissions', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`권한 조회 실패: ${response.status}`);
  return response.json();
}
```

### 프론트엔드 활용 — 공유 폼 분기 예시

```typescript
const myPerms = await getMyPermissions(token);
const hasDirectShare = myPerms.permissions.includes('FILE_SHARE_DIRECT');

if (hasDirectShare) {
  // 승인자 선택 UI 숨김, designatedApproverId 생략
  showBanner('이 공유는 즉시 생성됩니다 (자동 승인)');
} else {
  // 승인자 선택 UI 표시, designatedApproverId 필수
  showBanner('이 공유 요청은 승인자의 승인 후 생성됩니다');
  const approvers = await getApprovers(token);
  // 승인자 선택 드롭다운 렌더링
}
```

### 에러 응답

| Status | 설명 |
|--------|------|
| `401` | 인증 필요 |
| `404` | 사용자 또는 역할을 찾을 수 없음 |

---

## 5. 700 · 공유 대상자 조회 (내부 + 외부)

파일 공유 대상자를 검색합니다. 내부 사용자와 외부 사용자를 통합하여 조회합니다.

### 요청

```
GET /v1/file-shares-requests/users
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `type` | `string` | X | 전체 | `INTERNAL`(내부) / `EXTERNAL`(외부) |
| `name` | `string` | X | - | 이름 (부분 일치) |
| `department` | `string` | X | - | 부서명 (부분 일치) |
| `email` | `string` | X | - | 이메일 (부분 일치) |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "type": "INTERNAL",
      "name": "홍길동",
      "email": "hong@example.com",
      "department": "개발팀",
      "roleName": "ADMIN",
      "isActive": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "type": "EXTERNAL",
      "name": "김외부",
      "email": "kim@partner.com",
      "department": "외부",
      "roleName": null,
      "isActive": true
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

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
const response = await fetch(
  `/v1/file-shares-requests/users?type=INTERNAL&name=홍&page=1&pageSize=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const data: PaginatedResponse<ShareTargetUser> = await response.json();
```

---

## 6. 700 · 승인 가능 사용자 검색

공유 요청 생성 시 승인 대상자를 검색합니다. 매니저(MANAGER) 이상 역할의 활성 사용자만 반환됩니다.

### 요청

```
GET /v1/file-shares-requests/approvers
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `keyword` | `string` | X | - | 통합 검색 키워드 (이름, 부서명, 이메일, 사번 OR 검색) |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "김매니저",
      "email": "kim@company.com",
      "employeeNumber": "EMP001",
      "departmentName": "개발팀",
      "positionName": "팀장",
      "role": {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "MANAGER",
        "description": "매니저"
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 15,
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
const response = await fetch(
  `/v1/file-shares-requests/approvers?keyword=김&page=1&pageSize=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const data: PaginatedResponse<ApproverResponse> = await response.json();
```

---

## 7. 700 · 공유 요청 가용성 확인

파일과 공유 대상에 대한 가용성을 사전 확인합니다. 실제 공유 요청을 생성하기 전에 충돌 여부를 미리 확인하는 용도입니다.

### 요청

```
POST /v1/file-shares-requests/requests/check-availability
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `fileIds` | `string[]` | O | 확인할 파일 ID 목록 (UUID) | `["550e8400-..."]` |
| `targets` | `ShareTarget[]` | O | 확인할 공유 대상 목록 | 아래 참고 |
| `targets[].type` | `string` | O | 대상 타입 | `"INTERNAL_USER"` |
| `targets[].userId` | `string` | O | 사용자 ID (UUID) | `"550e8400-..."` |

### 요청 예시

```json
{
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "targets": [
    { "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440010" },
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }
  ]
}
```

### 응답 예시 (모두 가용)

```json
{
  "available": true,
  "results": [
    {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "target": { "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440010" },
      "targetName": "홍길동",
      "status": "AVAILABLE"
    },
    {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "target": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" },
      "targetName": "김외부",
      "status": "AVAILABLE"
    }
  ]
}
```

### 응답 예시 (충돌 존재)

```json
{
  "available": false,
  "results": [
    {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "target": { "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440010" },
      "targetName": "홍길동",
      "status": "ACTIVE_SHARE_EXISTS",
      "conflict": {
        "conflictType": "ACTIVE_SHARE_EXISTS",
        "fileId": "550e8400-e29b-41d4-a716-446655440001",
        "targetUserId": "550e8400-e29b-41d4-a716-446655440010",
        "publicShareId": "660e8400-e29b-41d4-a716-446655440050"
      }
    },
    {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "target": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" },
      "targetName": "김외부",
      "status": "PENDING_REQUEST_EXISTS",
      "conflict": {
        "conflictType": "PENDING_REQUEST_EXISTS",
        "fileId": "550e8400-e29b-41d4-a716-446655440001",
        "targetUserId": "550e8400-e29b-41d4-a716-446655440020",
        "shareRequestId": "770e8400-e29b-41d4-a716-446655440060",
        "requestedAt": "2026-02-09T10:00:00.000Z",
        "requesterName": "이전요청자"
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
const response = await fetch('/v1/file-shares-requests/requests/check-availability', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileIds: ['550e8400-e29b-41d4-a716-446655440001'],
    targets: [
      { type: 'INTERNAL_USER', userId: '550e8400-e29b-41d4-a716-446655440010' },
    ],
  }),
});

const data: CheckAvailabilityResponse = await response.json();

if (!data.available) {
  // 충돌이 있는 항목만 필터링하여 사용자에게 표시
  const conflicts = data.results.filter(r => r.status !== 'AVAILABLE');
  conflicts.forEach(c => {
    if (c.status === 'ACTIVE_SHARE_EXISTS') {
      console.warn(`${c.fileName} → ${c.targetName}: 이미 활성 공유 존재`);
    } else if (c.status === 'PENDING_REQUEST_EXISTS') {
      console.warn(`${c.fileName} → ${c.targetName}: 대기 중인 요청 존재`);
    }
  });
}
```

---

## 8. 700 · 공유 요청 생성

파일 공유를 요청합니다.

- `FILE_SHARE_DIRECT` 권한: 즉시 승인 + PublicShare 생성
- `FILE_SHARE_REQUEST` 권한: PENDING 상태 저장 → 승인자 승인 대기

### 요청

```
POST /v1/file-shares-requests/requests
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `fileIds` | `string[]` | O | 공유할 파일 ID 목록 (UUID) | `["550e8400-..."]` |
| `targets` | `ShareTarget[]` | O | 공유 대상 목록 | 아래 참고 |
| `targets[].type` | `string` | O | `INTERNAL_USER` / `EXTERNAL_USER` | `"INTERNAL_USER"` |
| `targets[].userId` | `string` | O | 사용자 ID (UUID) | `"550e8400-..."` |
| `permission` | `SharePermission` | O | 부여할 권한 | 아래 참고 |
| `permission.type` | `string` | O | `VIEW` / `DOWNLOAD` | `"DOWNLOAD"` |
| `permission.maxDownloads` | `number` | X | 최대 다운로드 횟수 (≥1) | `5` |
| `startAt` | `string` | O | 공유 시작일시 (ISO 8601) | `"2026-02-10T00:00:00.000Z"` |
| `endAt` | `string` | O | 공유 종료일시 (ISO 8601) | `"2026-02-28T23:59:59.000Z"` |
| `reason` | `string` | O | 공유 요청 사유 | `"프로젝트 협업"` |
| `designatedApproverId` | `string` | O | 승인 대상자 ID (UUID) | `"550e8400-..."` |

### 요청 예시

```json
{
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }
  ],
  "permission": {
    "type": "DOWNLOAD",
    "maxDownloads": 5
  },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003"
}
```

### 응답 예시

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440070",
  "status": "PENDING",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "files": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "설계문서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }
  ],
  "requesterId": "990e8400-e29b-41d4-a716-446655440080",
  "requesterDetail": {
    "type": "INTERNAL_USER",
    "userId": "990e8400-e29b-41d4-a716-446655440080",
    "name": "홍길동",
    "email": "hong@company.com",
    "department": "개발팀",
    "position": "선임"
  },
  "targets": [
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }
  ],
  "targetDetails": [
    {
      "type": "EXTERNAL_USER",
      "userId": "550e8400-e29b-41d4-a716-446655440020",
      "userDetail": {
        "type": "EXTERNAL_USER",
        "userId": "550e8400-e29b-41d4-a716-446655440020",
        "name": "김외부",
        "email": "kim@partner.com",
        "company": "파트너사",
        "department": "기술팀"
      }
    }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "designatedApproverDetail": {
    "type": "INTERNAL_USER",
    "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저",
    "email": "kim@company.com",
    "department": "개발팀",
    "position": "팀장"
  },
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

> `isAutoApproved: true`이면 바로 승인되어 `publicShareIds`에 생성된 공유 ID가 들어갑니다.
>
> **Enriched 필드**: `files`, `requesterDetail`, `targetDetails`, `designatedApproverDetail`, `approverDetail`은 항상 포함됩니다. 파일이나 사용자가 삭제된 경우 해당 항목은 누락될 수 있습니다.

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `400` | - | 필수 필드 누락 또는 유효성 검증 실패 | 입력값 검증 |
| `400` | `2007` | 시작일이 종료일보다 이후 | 날짜 범위 재설정 |
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | `2001` | 파일 공유 권한 없음 | 권한 확인 안내 |
| `403` | `2002` | 비활성 사용자 | 관리자 문의 안내 |
| `404` | `1001` | 파일을 찾을 수 없음 | 파일 ID 확인 |
| `409` | `2004` | 이미 활성 공유 존재 | 기존 공유 안내 (가용성 확인 API 활용) |
| `409` | `2005` | 대기 중인 요청 존재 | 기존 요청 안내 (가용성 확인 API 활용) |
| `422` | `2018` | 유효하지 않은 승인 대상자 | 승인자 목록에서 재선택 안내 |

### fetch 예시

```typescript
const response = await fetch('/v1/file-shares-requests/requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileIds: ['550e8400-e29b-41d4-a716-446655440001'],
    targets: [{ type: 'EXTERNAL_USER', userId: '550e8400-e29b-41d4-a716-446655440020' }],
    permission: { type: 'DOWNLOAD', maxDownloads: 5 },
    startAt: '2026-02-10T00:00:00.000Z',
    endAt: '2026-02-28T23:59:59.000Z',
    reason: '프로젝트 협업을 위한 파일 공유',
    designatedApproverId: '550e8400-e29b-41d4-a716-446655440003',
  }),
});

const data: ShareRequestResponse = await response.json();

if (data.isAutoApproved) {
  // 자동 승인 → 성공 알림 + 생성된 공유 ID 표시
  alert(`공유가 즉시 생성되었습니다. (공유 ${data.publicShareIds.length}건)`);
} else {
  // 승인 대기 → 대기 안내
  alert('공유 요청이 제출되었습니다. 승인자의 승인을 기다려주세요.');
}
```

---

## 9. 701 · 내 공유 통합 목록

내가 보낸 공유(ShareRequest + PublicShare)를 통합하여 조회합니다.

### 요청

```
GET /v1/file-shares-requests
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `string` | X | 전체 | `PENDING` / `APPROVED` / `REJECTED` / `CANCELED` / `ACTIVE` / `REVOKED` |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `createdAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | `asc` / `desc` |

### 응답 예시

```json
{
  "items": [
    {
      "source": "SHARE_REQUEST",
      "id": "880e8400-e29b-41d4-a716-446655440070",
      "status": "PENDING",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "createdAt": "2026-02-10T09:00:00.000Z",
      "ownerId": "990e8400-e29b-41d4-a716-446655440080"
    },
    {
      "source": "PUBLIC_SHARE",
      "id": "660e8400-e29b-41d4-a716-446655440050",
      "status": "ACTIVE",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440002"],
      "createdAt": "2026-02-08T14:30:00.000Z",
      "ownerId": "990e8400-e29b-41d4-a716-446655440080"
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

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
const response = await fetch(
  `/v1/file-shares-requests?status=PENDING&page=1&pageSize=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const data: PaginatedResponse<MySentShareItem> = await response.json();
```

---

## 10. 701 · 공유 상세 조회 (PublicShare)

특정 공유(PublicShare)의 상세 정보를 조회합니다.

### 요청

```
GET /v1/file-shares-requests/:id
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

### 응답 예시

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440050",
  "fileId": "550e8400-e29b-41d4-a716-446655440002",
  "ownerId": "990e8400-e29b-41d4-a716-446655440080",
  "externalUserId": "550e8400-e29b-41d4-a716-446655440020",
  "permissions": ["VIEW", "DOWNLOAD"],
  "maxViewCount": 10,
  "currentViewCount": 3,
  "maxDownloadCount": 5,
  "currentDownloadCount": 1,
  "expiresAt": "2026-02-28T23:59:59.000Z",
  "isBlocked": false,
  "isRevoked": false,
  "createdAt": "2026-02-08T14:30:00.000Z",
  "updatedAt": "2026-02-10T09:15:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `401` | - | 인증 필요 | 토큰 재발급 |
| `404` | `2144` | 공유를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/${shareId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: PublicShareResponse = await response.json();
```

---

## 11. 701 · 공유 취소/철회

공유를 취소하거나 철회합니다. ID에 따라 서버에서 자동 분기됩니다.

### 분기 로직

| 대상 | 상태 | 동작 | 응답 타입 |
|------|------|------|-----------|
| ShareRequest | PENDING | 요청 취소 (cancel) | `ShareRequestResponse` |
| PublicShare | ACTIVE | 공유 철회 (revoke) | `RevokeShareResponse` |
| 그 외 | - | 404 에러 | - |

### 요청

```
POST /v1/file-shares-requests/:id/cancel
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 취소/철회할 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

### 응답 예시 (ShareRequest 취소)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440070",
  "status": "CANCELED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "files": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "설계문서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }
  ],
  "requesterId": "990e8400-e29b-41d4-a716-446655440080",
  "requesterDetail": {
    "type": "INTERNAL_USER", "userId": "990e8400-e29b-41d4-a716-446655440080",
    "name": "홍길동", "email": "hong@company.com", "department": "개발팀"
  },
  "targets": [{ "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }],
  "targetDetails": [
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "userDetail": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "name": "김외부", "email": "kim@partner.com" } }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "designatedApproverDetail": {
    "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저", "email": "kim@company.com", "department": "개발팀"
  },
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

### 응답 예시 (PublicShare 철회)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440050",
  "isRevoked": true
}
```

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `400` | `2010` | 취소할 수 없는 상태 (이미 승인/거부/취소됨) | 상태 확인 안내 |
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | `2011` / `2145` | 본인이 요청/소유한 공유만 취소/철회 가능 | 권한 확인 |
| `404` | `2006` | 공유를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/${id}/cancel`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();

// 응답 타입 판별
if ('isRevoked' in data) {
  // PublicShare 철회 응답
  const revokeResult = data as RevokeShareResponse;
  alert('공유가 철회되었습니다.');
} else {
  // ShareRequest 취소 응답
  const cancelResult = data as ShareRequestResponse;
  alert('공유 요청이 취소되었습니다.');
}
```

---

## 12. 702 · 받은 공유 요청 목록

본인에게 지정된(designatedApproverId) 공유 요청 목록을 조회합니다.

### 요청

```
GET /v1/file-shares-requests/received
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `string` | X | `PENDING` | `PENDING` / `APPROVED` / `REJECTED` / `CANCELED` |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `requestedAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | `asc` / `desc` |

### 응답 예시

```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440070",
      "status": "PENDING",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "files": [
        { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "설계문서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }
      ],
      "requesterId": "990e8400-e29b-41d4-a716-446655440080",
      "requesterDetail": {
        "type": "INTERNAL_USER", "userId": "990e8400-e29b-41d4-a716-446655440080",
        "name": "홍길동", "email": "hong@company.com", "department": "개발팀", "position": "선임"
      },
      "targets": [{ "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }],
      "targetDetails": [
        { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "userDetail": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "name": "김외부", "email": "kim@partner.com", "company": "파트너사" } }
      ],
      "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
      "startAt": "2026-02-10T00:00:00.000Z",
      "endAt": "2026-02-28T23:59:59.000Z",
      "reason": "프로젝트 협업을 위한 파일 공유",
      "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
      "designatedApproverDetail": {
        "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
        "name": "김매니저", "email": "kim@company.com", "department": "개발팀", "position": "팀장"
      },
      "isAutoApproved": false,
      "publicShareIds": [],
      "requestedAt": "2026-02-10T09:00:00.000Z"
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

> 목록 API에서도 각 항목에 파일/사용자 상세 정보가 포함됩니다. 프론트엔드에서 추가 API 호출 없이 바로 화면에 표시할 수 있습니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
const response = await fetch(
  `/v1/file-shares-requests/received?status=PENDING&page=1&pageSize=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const data: PaginatedResponse<ShareRequestResponse> = await response.json();

// 이제 파일명, 요청자명 등을 바로 사용 가능
data.items.forEach(item => {
  console.log(`파일: ${item.files?.map(f => f.name).join(', ')}`);
  console.log(`요청자: ${item.requesterDetail?.name} (${item.requesterDetail?.department})`);
  console.log(`대상자: ${item.targetDetails?.map(t => t.userDetail?.name).join(', ')}`);
});
```

---

## 13. 702 · 받은 공유 요청 상세 조회

본인에게 지정된 공유 요청의 상세 정보를 조회합니다.

### 요청

```
GET /v1/file-shares-requests/received/:id
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 요청 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

`ShareRequestResponse`와 동일한 구조이며, 파일/사용자 상세 정보가 포함됩니다 (8번 섹션 응답 참고).

> 상세 조회에서도 `files`, `requesterDetail`, `targetDetails`, `designatedApproverDetail` 등 enriched 필드가 포함되므로, 승인/반려 화면에서 파일명, 요청자 이름/부서 등을 바로 표시할 수 있습니다.

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | - | 본인에게 지정된 요청만 조회 가능 | 권한 확인 |
| `404` | `2006` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/received/${id}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: ShareRequestResponse = await response.json();

// 상세 화면에서 바로 사용 가능한 enriched 정보
console.log(`요청자: ${data.requesterDetail?.name} (${data.requesterDetail?.department})`);
console.log(`파일: ${data.files?.map(f => `${f.name} (${(f.sizeBytes / 1024).toFixed(0)}KB)`).join(', ')}`);
console.log(`대상자: ${data.targetDetails?.map(t => t.userDetail?.name).join(', ')}`);
console.log(`승인자: ${data.designatedApproverDetail?.name}`);
```

---

## 14. 702 · 받은 공유 요청 승인

본인에게 지정된 공유 요청을 승인합니다. 승인 시 PublicShare가 생성됩니다.

### 요청

```
POST /v1/file-shares-requests/received/:id/approve
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
  "id": "880e8400-e29b-41d4-a716-446655440070",
  "status": "APPROVED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "files": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "설계문서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }
  ],
  "requesterId": "990e8400-e29b-41d4-a716-446655440080",
  "requesterDetail": {
    "type": "INTERNAL_USER", "userId": "990e8400-e29b-41d4-a716-446655440080",
    "name": "홍길동", "email": "hong@company.com", "department": "개발팀"
  },
  "targets": [{ "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }],
  "targetDetails": [
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "userDetail": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "name": "김외부", "email": "kim@partner.com" } }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "designatedApproverDetail": {
    "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저", "email": "kim@company.com", "department": "개발팀"
  },
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "approverDetail": {
    "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저", "email": "kim@company.com", "department": "개발팀"
  },
  "decidedAt": "2026-02-10T10:00:00.000Z",
  "decisionComment": "승인합니다.",
  "isAutoApproved": false,
  "publicShareIds": ["660e8400-e29b-41d4-a716-446655440050"],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `400` | `2008` | 승인할 수 없는 상태 (이미 승인/거부/취소됨) | 상태 확인 후 새로고침 |
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | - | 본인에게 지정된 요청만 승인 가능 | 권한 확인 |
| `404` | `2006` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/received/${id}/approve`, {
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

## 15. 702 · 받은 공유 요청 반려

본인에게 지정된 공유 요청을 반려합니다. 반려 코멘트는 **필수**입니다.

### 요청

```
POST /v1/file-shares-requests/received/:id/reject
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
  "id": "880e8400-e29b-41d4-a716-446655440070",
  "status": "REJECTED",
  "fileIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "files": [
    { "id": "550e8400-e29b-41d4-a716-446655440001", "name": "설계문서.pdf", "mimeType": "application/pdf", "sizeBytes": 1048576 }
  ],
  "requesterId": "990e8400-e29b-41d4-a716-446655440080",
  "requesterDetail": {
    "type": "INTERNAL_USER", "userId": "990e8400-e29b-41d4-a716-446655440080",
    "name": "홍길동", "email": "hong@company.com", "department": "개발팀"
  },
  "targets": [{ "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020" }],
  "targetDetails": [
    { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "userDetail": { "type": "EXTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440020", "name": "김외부", "email": "kim@partner.com" } }
  ],
  "permission": { "type": "DOWNLOAD", "maxDownloads": 5 },
  "startAt": "2026-02-10T00:00:00.000Z",
  "endAt": "2026-02-28T23:59:59.000Z",
  "reason": "프로젝트 협업을 위한 파일 공유",
  "designatedApproverId": "550e8400-e29b-41d4-a716-446655440003",
  "designatedApproverDetail": {
    "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저", "email": "kim@company.com", "department": "개발팀"
  },
  "approverId": "550e8400-e29b-41d4-a716-446655440003",
  "approverDetail": {
    "type": "INTERNAL_USER", "userId": "550e8400-e29b-41d4-a716-446655440003",
    "name": "김매니저", "email": "kim@company.com", "department": "개발팀"
  },
  "decidedAt": "2026-02-10T10:00:00.000Z",
  "decisionComment": "보안 정책에 위배됩니다.",
  "isAutoApproved": false,
  "publicShareIds": [],
  "requestedAt": "2026-02-10T09:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `400` | `2009` | 반려할 수 없는 상태 또는 코멘트 누락 | 상태 확인 + 코멘트 입력 검증 |
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | - | 본인에게 지정된 요청만 반려 가능 | 권한 확인 |
| `404` | `2006` | 공유 요청을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/received/${id}/reject`, {
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

## 16. 710 · 나에게 공유된 파일 목록

현재 로그인한 외부 사용자에게 공유된 파일 목록을 조회합니다. 활성 상태이며 만료되지 않은 공유만 표시됩니다.

### 요청

```
GET /v1/file-shares-requests/me
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `createdAt` | 정렬 기준 필드 |
| `sortOrder` | `string` | X | `desc` | `asc` / `desc` |

### 응답 예시

```json
{
  "items": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440050",
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "permissions": ["VIEW", "DOWNLOAD"],
      "expiresAt": "2026-02-28T23:59:59.000Z",
      "createdAt": "2026-02-08T14:30:00.000Z"
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

### fetch 예시

```typescript
const response = await fetch(
  `/v1/file-shares-requests/me?page=1&pageSize=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const data: PaginatedResponse<MyShareListItem> = await response.json();
```

---

## 17. 710 · 공유 상세 조회 + 콘텐츠 토큰 발급

특정 공유의 상세 정보를 조회하고, 파일 접근을 위한 **일회성 콘텐츠 토큰**을 발급받습니다.

> **중요:** 파일 뷰 또는 다운로드 전에 반드시 이 API를 호출하여 `contentToken`을 획득해야 합니다.

### 요청

```
GET /v1/file-shares-requests/:shareId
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `shareId` | `string (UUID)` | 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

### 응답 예시

```json
{
  "share": {
    "id": "660e8400-e29b-41d4-a716-446655440050",
    "fileId": "550e8400-e29b-41d4-a716-446655440001",
    "fileName": "설계문서.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "permissions": ["VIEW", "DOWNLOAD"],
    "maxViewCount": 10,
    "currentViewCount": 3,
    "maxDownloadCount": 5,
    "currentDownloadCount": 1,
    "expiresAt": "2026-02-28T23:59:59.000Z"
  },
  "contentToken": "ct_abc123def456ghi789jkl012mno345pqr",
  "tokenExpiresAt": "2026-02-12T10:01:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `401` | - | 인증 필요 | 토큰 재발급 |
| `403` | `2111` | 접근 권한 없음 (본인에게 공유되지 않음) | 권한 확인 |
| `404` | `2110` | 공유를 찾을 수 없음 | ID 확인 |
| `410` | `2117` | 공유가 만료되었거나 취소됨 | 만료 안내 |

### fetch 예시

```typescript
const response = await fetch(`/v1/file-shares-requests/${shareId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

const data: ShareDetailResponse = await response.json();
// data.contentToken → 뷰/다운로드 API에서 사용
// data.tokenExpiresAt → 토큰 만료 시간 확인
```

---

## 18. 710 · 파일 콘텐츠 (뷰어용)

파일 콘텐츠를 뷰어에서 표시하기 위해 조회합니다. `inline` Content-Disposition으로 반환됩니다.

### 사전 조건

1. `GET /v1/file-shares-requests/:shareId`에서 `contentToken`을 발급받아야 합니다.
2. `VIEW` 권한이 있어야 합니다.

### 요청

```
GET /v1/file-shares-requests/:shareId/content?token={contentToken}
```

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `shareId` | `string (UUID)` | O | 공유 ID | `550e8400-...` |
| `token` | `string` | **O** | 콘텐츠 접근 토큰 | `ct_abc123...` |

### 응답

- **200 OK**: 파일 전체 콘텐츠 (바이너리 스트림)
- **206 Partial Content**: Range 요청 시 부분 콘텐츠

### 응답 헤더

| 헤더 | 설명 |
|------|------|
| `Content-Type` | 파일 MIME 타입 (예: `application/pdf`) |
| `Content-Disposition` | `inline; filename*=UTF-8''파일명.확장자` |
| `Content-Length` | 콘텐츠 크기 (bytes) |
| `Accept-Ranges` | `bytes` |
| `ETag` | 파일 체크섬 기반 ETag |
| `X-Checksum-SHA256` | SHA256 체크섬 (전체 파일일 때만) |

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `401` | `2112` | 유효하지 않은 콘텐츠 토큰 | 상세 조회를 다시 수행하여 토큰 재발급 |
| `401` | `2113` | 이미 사용된 토큰 | 상세 조회를 다시 수행하여 토큰 재발급 |
| `403` | `2120` | VIEW 권한 없음 | 권한 확인 안내 |
| `416` | - | Range Not Satisfiable | Range 헤더 수정 |
| `429` | `2118` | 최대 조회 횟수 초과 | 횟수 초과 안내 |

### fetch 예시

```typescript
// 1. 상세 조회에서 contentToken 획득
const detail = await fetch(`/v1/file-shares-requests/${shareId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
}).then(r => r.json()) as ShareDetailResponse;

// 2. 콘텐츠 조회 (뷰어에 표시)
const contentUrl =
  `/v1/file-shares-requests/${shareId}/content?token=${detail.contentToken}`;

// iframe/embed 방식
const iframe = document.createElement('iframe');
iframe.src = contentUrl;  // 인증 헤더가 필요하므로 fetch blob 방식 권장

// fetch blob 방식 (권장)
const contentResponse = await fetch(contentUrl, {
  headers: { 'Authorization': `Bearer ${token}` },
});
const blob = await contentResponse.blob();
const blobUrl = URL.createObjectURL(blob);

// PDF 뷰어 등에서 사용
window.open(blobUrl);
```

---

## 19. 710 · 파일 다운로드

파일을 다운로드합니다. `attachment` Content-Disposition으로 반환됩니다.

### 사전 조건

1. `GET /v1/file-shares-requests/:shareId`에서 `contentToken`을 발급받아야 합니다.
2. `DOWNLOAD` 권한이 있어야 합니다.

### 요청

```
GET /v1/file-shares-requests/:shareId/download?token={contentToken}
```

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `shareId` | `string (UUID)` | O | 공유 ID | `550e8400-...` |
| `token` | `string` | **O** | 콘텐츠 접근 토큰 | `ct_abc123...` |

### 응답

바이너리 스트림 + `Content-Disposition: attachment` 헤더

### 에러 응답

| 상태 코드 | 에러 코드 | 설명 | 대응 |
|-----------|-----------|------|------|
| `401` | `2112` | 유효하지 않은 콘텐츠 토큰 | 상세 조회를 다시 수행하여 토큰 재발급 |
| `401` | `2113` | 이미 사용된 토큰 | 상세 조회를 다시 수행하여 토큰 재발급 |
| `403` | `2121` | DOWNLOAD 권한 없음 | 권한 확인 안내 |
| `416` | - | Range Not Satisfiable | Range 헤더 수정 |
| `429` | `2119` | 최대 다운로드 횟수 초과 | 횟수 초과 안내 |

### fetch 예시

```typescript
// 1. 상세 조회에서 contentToken 획득
const detail = await fetch(`/v1/file-shares-requests/${shareId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
}).then(r => r.json()) as ShareDetailResponse;

// 2. 다운로드
const downloadResponse = await fetch(
  `/v1/file-shares-requests/${shareId}/download?token=${detail.contentToken}`,
  {
    headers: { 'Authorization': `Bearer ${token}` },
  },
);

const blob = await downloadResponse.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = detail.share.fileName;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
```

---

## 20. Enum 값 정리

### ShareTargetUserType (대상자 유형 필터)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `INTERNAL` | 내부 사용자 | 내부 직원 |
| `EXTERNAL` | 외부 사용자 | 외부 사용자 |

### ShareTargetType (공유 대상 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `INTERNAL_USER` | 내부 사용자 대상 공유 | 내부 직원 |
| `EXTERNAL_USER` | 외부 사용자 대상 공유 | 외부 사용자 |

### SharePermissionType (공유 권한)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `VIEW` | 뷰어에서 파일 보기만 가능 | 보기 전용 |
| `DOWNLOAD` | 파일 다운로드 가능 | 다운로드 |

### ShareRequestStatus (공유 요청 상태)

| 값 | 설명 | UI 표시 (제안) | 배지 색상 (제안) |
|----|------|---------------|----------------|
| `PENDING` | 승인 대기 중 | 승인 대기 | 노란색 |
| `APPROVED` | 승인됨 | 승인됨 | 초록색 |
| `REJECTED` | 반려됨 | 반려됨 | 빨간색 |
| `CANCELED` | 취소됨 | 취소됨 | 회색 |

### MySentShareStatus (내가 보낸 공유 통합 상태)

| 값 | 출처 | 설명 | UI 표시 (제안) | 배지 색상 (제안) |
|----|------|------|---------------|----------------|
| `PENDING` | ShareRequest | 승인 대기 중 | 승인 대기 | 노란색 |
| `APPROVED` | ShareRequest | 승인됨 | 승인됨 | 초록색 |
| `REJECTED` | ShareRequest | 반려됨 | 반려됨 | 빨간색 |
| `CANCELED` | ShareRequest | 취소됨 | 취소됨 | 회색 |
| `ACTIVE` | PublicShare | 공유 활성 중 | 공유 중 | 파란색 |
| `REVOKED` | PublicShare | 공유 철회됨 | 철회됨 | 회색 |

### AvailabilityStatus (가용성 확인 결과)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `AVAILABLE` | 공유 가능 | 가능 |
| `ACTIVE_SHARE_EXISTS` | 이미 활성 공유 존재 | 이미 공유 중 |
| `PENDING_REQUEST_EXISTS` | 대기 중인 요청 존재 | 승인 대기 중인 요청 있음 |

---

## 21. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `201` | 생성 성공 | 정상 처리 + 성공 알림 |
| `206` | 부분 콘텐츠 (Range) | 스트림 이어받기 처리 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `409` | 충돌 (중복 등) | 충돌 상세 정보 표시 |
| `410` | 만료 | "공유가 만료되었습니다" 표시 |
| `416` | Range 오류 | Range 재계산 후 재시도 |
| `422` | 비즈니스 규칙 위반 | 상세 에러 메시지 표시 |
| `429` | 횟수 제한 초과 | "횟수 초과" 안내 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### 도메인별 에러 코드 (code 필드 기반)

#### Share/ShareRequest 도메인 (2000~2099)

| 에러 코드 | internalCode | HTTP | 메시지 | 프론트엔드 대응 |
|-----------|-------------|------|--------|----------------|
| `2001` | `SHARE_PERMISSION_DENIED` | 403 | 파일 공유 권한이 없습니다 | 권한 부족 안내 팝업 |
| `2002` | `SHARE_INACTIVE_USER` | 403 | 비활성 사용자는 요청을 생성할 수 없습니다 | 관리자 문의 안내 |
| `2003` | `SHARE_NO_ROLE` | 403 | 권한이 없습니다 | 권한 부족 안내 팝업 |
| `2004` | `SHARE_ACTIVE_EXISTS` | 409 | 이미 활성 공유가 존재합니다 | 기존 공유 정보 표시, 가용성 확인 유도 |
| `2005` | `SHARE_PENDING_EXISTS` | 409 | 대기 중인 요청이 존재합니다 | 기존 요청 정보 표시, 가용성 확인 유도 |
| `2006` | `SHARE_REQUEST_NOT_FOUND` | 404 | 공유 요청을 찾을 수 없습니다 | 목록으로 돌아가기 |
| `2007` | `SHARE_INVALID_DATE_RANGE` | 400 | 시작일은 종료일보다 이전이어야 합니다 | 날짜 입력 필드 검증 표시 |
| `2008` | `SHARE_NOT_APPROVABLE` | 400 | 승인할 수 없는 상태입니다 | 목록 새로고침 + 상태 변경 안내 |
| `2009` | `SHARE_NOT_REJECTABLE` | 400 | 반려할 수 없는 상태입니다 | 목록 새로고침 + 상태 변경 안내 |
| `2010` | `SHARE_NOT_CANCELLABLE` | 400 | 취소할 수 없는 상태입니다 | 목록 새로고침 + 상태 변경 안내 |
| `2011` | `SHARE_CANCEL_NOT_OWNER` | 403 | 본인이 요청한 공유만 취소할 수 있습니다 | 권한 확인 안내 |
| `2018` | `SHARE_INVALID_APPROVER` | 422 | 유효하지 않은 승인 대상자입니다 | 승인자 목록 새로고침 + 재선택 유도 |

#### External Share 도메인 (2100~2199) — 710용

| 에러 코드 | internalCode | HTTP | 메시지 | 프론트엔드 대응 |
|-----------|-------------|------|--------|----------------|
| `2110` | `EXT_SHARE_NOT_FOUND` | 404 | 공유를 찾을 수 없습니다 | 목록으로 돌아가기 |
| `2111` | `EXT_SHARE_ACCESS_DENIED` | 403 | 접근 권한이 없습니다 | "접근 권한 없음" 페이지 표시 |
| `2112` | `EXT_SHARE_TOKEN_INVALID` | 401 | 콘텐츠 토큰이 유효하지 않습니다 | 상세 조회 재호출 → 새 토큰 획득 |
| `2113` | `EXT_SHARE_TOKEN_USED` | 401 | 이미 사용된 토큰입니다 | 상세 조회 재호출 → 새 토큰 획득 |
| `2114` | `EXT_SHARE_BLOCKED` | 403 | 관리자에 의해 차단된 공유입니다 | "관리자에 의해 차단됨" 안내 |
| `2116` | `EXT_SHARE_REVOKED` | 403 | 공유가 취소되었습니다 | "공유 취소됨" 안내 |
| `2117` | `EXT_SHARE_EXPIRED` | 410 | 공유 기간이 만료되었습니다 | "공유 만료" 안내 페이지 |
| `2118` | `EXT_SHARE_VIEW_LIMIT` | 429 | 조회 횟수 제한을 초과했습니다 | "조회 횟수 초과" 안내 |
| `2119` | `EXT_SHARE_DOWNLOAD_LIMIT` | 429 | 다운로드 횟수 제한을 초과했습니다 | "다운로드 횟수 초과" 안내 |
| `2120` | `EXT_SHARE_VIEW_DENIED` | 403 | 조회 권한이 없습니다 | "보기 권한 없음" 안내 |
| `2121` | `EXT_SHARE_DOWNLOAD_DENIED` | 403 | 다운로드 권한이 없습니다 | "다운로드 권한 없음" 안내 |

#### Public Share 도메인 (2140~2149) — 701용

| 에러 코드 | internalCode | HTTP | 메시지 | 프론트엔드 대응 |
|-----------|-------------|------|--------|----------------|
| `2144` | `PUBLIC_SHARE_NOT_FOUND` | 404 | 공유를 찾을 수 없습니다 | 목록으로 돌아가기 |
| `2145` | `PUBLIC_SHARE_NOT_OWNER` | 403 | 공유 소유자만 취소할 수 있습니다 | 권한 확인 안내 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "최소 1개 이상의 파일을 선택해야 합니다.",
    "올바른 파일 ID 형식이 아닙니다."
  ],
  "error": "Bad Request"
}
```

> `message`는 배열로 올 수 있습니다. 각 항목을 필드별로 매핑하여 표시하세요.

### 비즈니스 에러 응답 형식

```json
{
  "statusCode": 409,
  "code": 2004,
  "internalCode": "SHARE_ACTIVE_EXISTS",
  "message": "이미 활성 공유가 존재합니다.",
  "details": { ... }
}
```

### 에러 처리 유틸리티

```typescript
interface ApiError {
  statusCode: number;
  code?: number;           // 도메인별 에러 코드
  internalCode?: string;   // 내부 식별자
  message: string | string[];
  error?: string;
  details?: Record<string, unknown>;
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

    // 콘텐츠 토큰 관련 에러 → 자동 재발급 시도
    if (error.code === 2112 || error.code === 2113) {
      // 상세 조회를 다시 수행하여 새 토큰 획득 후 재시도
      throw new ContentTokenExpiredError(error);
    }

    throw error;
  }

  return response.json();
}
```

---

## 22. 프론트엔드 플로우별 처리 가이드

### 플로우 1: 파일 공유 요청 생성 (600 → 700)

```
⓪ 나의 권한 조회 (GET /v1/users/me/permissions)
    → permissions 배열에서 FILE_SHARE_DIRECT 보유 여부 확인
    → hasDirectShare = permissions.includes('FILE_SHARE_DIRECT')

① 대상자 검색 (GET /users)
    → 사용자가 대상자 선택

② [조건] hasDirectShare === false 인 경우에만:
    → 승인자 검색 (GET /approvers)
    → 사용자가 승인자 선택

③ 가용성 확인 (POST /requests/check-availability)
    → available === false이면 충돌 정보 표시
    → available === true이면 다음 단계

④ 공유 요청 생성 (POST /requests)
    → hasDirectShare === true:
        body에서 designatedApproverId 생략
        → 응답: isAutoApproved === true, status === 'APPROVED'
        → "즉시 공유 완료" 알림, publicShareIds로 공유 상세 이동

    → hasDirectShare === false:
        body에 designatedApproverId 필수 포함
        → 응답: isAutoApproved === false, status === 'PENDING'
        → "승인 대기" 안내, 내 공유 목록으로 이동
```

#### 프론트엔드 구현 예시

```typescript
// ⓪ 공유 폼 진입 시 권한 조회
const myPerms = await getMyPermissions(token);
const hasDirectShare = myPerms.permissions.includes('FILE_SHARE_DIRECT');

// ④ 공유 요청 생성
const requestBody: CreateShareRequestRequest = {
  fileIds: selectedFileIds,
  targets: selectedTargets,
  permission: { type: 'VIEW' },
  startAt: '2026-02-10T00:00:00.000Z',
  endAt: '2026-02-28T23:59:59.000Z',
  reason: '프로젝트 협업을 위한 파일 공유',
  // FILE_SHARE_DIRECT 권한이 있으면 생략, 없으면 필수
  ...(hasDirectShare ? {} : { designatedApproverId: selectedApproverId }),
};

const result = await createShareRequest(token, requestBody);

if (result.isAutoApproved) {
  showSuccessToast('공유가 즉시 생성되었습니다.');
  navigateToShareDetail(result.publicShareIds[0]);
} else {
  showInfoToast('공유 요청이 등록되었습니다. 승인 후 공유가 생성됩니다.');
  navigateToMyRequests();
}
```

### 플로우 2: 내가 보낸 공유 관리 (701)

```
① 통합 목록 조회 (GET /)
    → status 필터로 탭 전환: 전체|대기|승인|반려|취소|공유중|철회
② 상세 조회
    → source === 'SHARE_REQUEST' → 요청 상세 (status로 상태 표시)
    → source === 'PUBLIC_SHARE' → 공유 상세 (GET /:id)
③ 취소/철회 (POST /:id/cancel)
    → 확인 다이얼로그 표시
    → 응답 타입으로 결과 분기 (취소 vs 철회)
```

### 플로우 3: 받은 공유 요청 관리 (702)

```
① 받은 요청 목록 (GET /received)
    → 기본 PENDING 필터 (승인 대기 중인 것만)
    → 목록에서 바로 파일명(files[].name), 요청자명(requesterDetail.name) 표시 가능
② 요청 상세 조회 (GET /received/:id)
    → 파일 정보 (files[]: 파일명, MIME 타입, 파일 크기)
    → 요청자 정보 (requesterDetail: 이름, 부서, 이메일)
    → 대상자 정보 (targetDetails[].userDetail: 이름, 이메일, 소속)
    → 승인자 정보 (designatedApproverDetail: 이름, 부서)
    → 사유 (reason) 등 표시
③-A 승인 (POST /received/:id/approve)
    → 코멘트 입력 (선택)
    → 승인 성공 → publicShareIds 확인
③-B 반려 (POST /received/:id/reject)
    → 코멘트 입력 (필수 — 빈 값 전송 시 400 에러)
    → 반려 성공 안내
```

### 플로우 4: 외부 사용자 파일 접근 (710)

```
① 공유 파일 목록 (GET /me)
    → 활성 공유만 표시
② 공유 상세 + 토큰 발급 (GET /:shareId)
    → contentToken 획득 (유효시간 60초)
③-A 뷰어에서 보기 (GET /:shareId/content?token=...)
    → fetch → blob → URL.createObjectURL → iframe/embed
③-B 파일 다운로드 (GET /:shareId/download?token=...)
    → fetch → blob → <a download> 트리거

⚠ 토큰 만료/재사용 에러 시:
    → ②번으로 돌아가 새 토큰 발급
    → 자동 재시도 로직 구현 권장
```

### 콘텐츠 토큰 자동 재시도 유틸리티

```typescript
/**
 * 콘텐츠 토큰 자동 재발급 후 재시도
 * 토큰 만료/사용 에러(2112, 2113) 발생 시 자동으로 새 토큰을 발급받아 재시도합니다.
 */
async function fetchWithTokenRetry(
  shareId: string,
  action: 'content' | 'download',
  authToken: string,
  maxRetries: number = 1,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 1. 상세 조회로 콘텐츠 토큰 획득
    const detailResponse = await fetch(`/v1/file-shares-requests/${shareId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const detail: ShareDetailResponse = await detailResponse.json();

    // 2. 콘텐츠/다운로드 요청
    const response = await fetch(
      `/v1/file-shares-requests/${shareId}/${action}?token=${detail.contentToken}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` },
      },
    );

    if (response.ok || response.status === 206) {
      return response;
    }

    // 3. 토큰 에러가 아니면 즉시 반환
    const error = await response.clone().json().catch(() => null);
    if (error?.code !== 2112 && error?.code !== 2113) {
      return response;
    }

    // 4. 마지막 시도면 에러 반환
    if (attempt === maxRetries) {
      return response;
    }

    // 5. 재시도 (루프 계속)
  }

  throw new Error('Unreachable');
}
```

---

## 23. cURL 테스트

```bash
# ─── 내부 사용자 토큰 발급 ───
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password"}' | jq -r '.accessToken')

# ─── 600. 나의 권한 조회 ───
curl -X GET "http://localhost:3000/v1/users/me/permissions" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 700. 공유 대상자 조회 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/users?type=INTERNAL&name=홍&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 700. 승인자 검색 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/approvers?keyword=김" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 700. 가용성 확인 ───
curl -X POST http://localhost:3000/v1/file-shares-requests/requests/check-availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["FILE_UUID_HERE"],
    "targets": [{"type": "EXTERNAL_USER", "userId": "USER_UUID_HERE"}]
  }' | jq

# ─── 700. 공유 요청 생성 ───
curl -X POST http://localhost:3000/v1/file-shares-requests/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["FILE_UUID_HERE"],
    "targets": [{"type": "EXTERNAL_USER", "userId": "USER_UUID_HERE"}],
    "permission": {"type": "DOWNLOAD", "maxDownloads": 5},
    "startAt": "2026-02-10T00:00:00.000Z",
    "endAt": "2026-02-28T23:59:59.000Z",
    "reason": "프로젝트 협업을 위한 파일 공유",
    "designatedApproverId": "APPROVER_UUID_HERE"
  }' | jq

# ─── 701. 내 공유 통합 목록 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests?status=PENDING&page=1" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 701. 공유 상세 조회 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/SHARE_UUID_HERE" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 701. 공유 취소/철회 ───
curl -X POST "http://localhost:3000/v1/file-shares-requests/SHARE_UUID_HERE/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# ─── 702. 받은 공유 요청 목록 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/received?status=PENDING" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 702. 받은 공유 요청 상세 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/received/REQUEST_UUID_HERE" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 702. 승인 ───
curl -X POST "http://localhost:3000/v1/file-shares-requests/received/REQUEST_UUID_HERE/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "승인합니다."}' | jq

# ─── 702. 반려 ───
curl -X POST "http://localhost:3000/v1/file-shares-requests/received/REQUEST_UUID_HERE/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "보안 정책에 위배됩니다."}' | jq

# ─── 외부 사용자 토큰 발급 ───
EXT_TOKEN=$(curl -s -X POST http://localhost:3000/v1/external-auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "external_user", "password": "password"}' | jq -r '.accessToken')

# ─── 710. 나에게 공유된 파일 목록 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/me?page=1" \
  -H "Authorization: Bearer $EXT_TOKEN" | jq

# ─── 710. 공유 상세 + 토큰 발급 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/SHARE_UUID_HERE" \
  -H "Authorization: Bearer $EXT_TOKEN" | jq

# ─── 710. 파일 콘텐츠 (뷰어용) ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/SHARE_UUID_HERE/content?token=CONTENT_TOKEN" \
  -H "Authorization: Bearer $EXT_TOKEN" \
  --output downloaded_file.pdf

# ─── 710. 파일 다운로드 ───
curl -X GET "http://localhost:3000/v1/file-shares-requests/SHARE_UUID_HERE/download?token=CONTENT_TOKEN" \
  -H "Authorization: Bearer $EXT_TOKEN" \
  --output downloaded_file.pdf
```
