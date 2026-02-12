# 701-B. 내가 보낸 공유 관리 - 프론트엔드 연동 가이드

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [공유 목록 조회](#4-공유-목록-조회)
5. [공유 상세 조회](#5-공유-상세-조회)
6. [공유 철회](#6-공유-철회)
7. [에러 처리](#7-에러-처리)
8. [cURL 테스트](#8-curl-테스트)

---

## 1. API 개요

내가 보낸 공유(PublicShare)를 조회하고, 상세 정보를 확인하고, 공유를 철회하는 API입니다.

| # | Method | URL | 설명 | 권한 |
|---|--------|-----|------|------|
| 1 | `GET` | `/v1/file-shares/my-shares` | 공유 목록 조회 | `FILE_SHARE_READ` |
| 2 | `GET` | `/v1/file-shares/my-shares/:id` | 공유 상세 조회 | `FILE_SHARE_READ` |
| 3 | `POST` | `/v1/file-shares/my-shares/:id/revoke` | 공유 철회 | `FILE_SHARE_REQUEST` |

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

### 공유 상태 Enum

| 값 | 설명 | UI 표시 예시 |
|----|------|-------------|
| `ACTIVE` | 공유 중 | 🟢 공유 중 |
| `REVOKED` | 철회됨 | ⚪ 철회됨 |

```typescript
type PublicShareStatus = 'ACTIVE' | 'REVOKED';
```

### 공유 목록 아이템

```typescript
interface MySentShareItem {
  /** 항목 출처 (항상 'PUBLIC_SHARE') */
  source: 'PUBLIC_SHARE';
  /** 공유 ID (UUID) */
  id: string;
  /** 상태 (ACTIVE 또는 REVOKED) */
  status: PublicShareStatus;
  /** 파일 ID 목록 (단건) */
  fileIds: string[];
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 소유자 ID (UUID) */
  ownerId: string;
}
```

### 공유 상세 응답

```typescript
interface PublicShareDetail {
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
  /** 철회 여부 */
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
```

### 공유 철회 응답

```typescript
interface RevokeShareResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 철회 여부 (항상 true) */
  isRevoked: boolean;
}
```

---

## 4. 공유 목록 조회

### `GET /v1/file-shares/my-shares`

내가 보낸 공유(PublicShare) 목록을 페이지네이션과 상태 필터로 조회합니다.

### 요청 파라미터 (Query String)

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `'ACTIVE' \| 'REVOKED'` | ❌ | - | 상태 필터 (미지정 시 전체 조회) |
| `page` | `number` | ❌ | `1` | 페이지 번호 (1 이상) |
| `pageSize` | `number` | ❌ | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | ❌ | `createdAt` | 정렬 기준 필드 |
| `sortOrder` | `'asc' \| 'desc'` | ❌ | `desc` | 정렬 순서 |

### 응답

```typescript
// 200 OK
PaginatedResponse<MySentShareItem>
```

### fetch 예시

```typescript
async function getMySentShares(
  token: string,
  params?: {
    status?: PublicShareStatus;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): Promise<PaginatedResponse<MySentShareItem>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(
    `/v1/file-shares/my-shares?${query}`,
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
      "source": "PUBLIC_SHARE",
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "status": "ACTIVE",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440010"],
      "createdAt": "2026-02-12T09:00:00.000Z",
      "ownerId": "550e8400-e29b-41d4-a716-446655440002"
    },
    {
      "source": "PUBLIC_SHARE",
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "status": "REVOKED",
      "fileIds": ["550e8400-e29b-41d4-a716-446655440011"],
      "createdAt": "2026-02-10T14:30:00.000Z",
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

## 5. 공유 상세 조회

### `GET /v1/file-shares/my-shares/:id`

특정 공유(PublicShare)의 상세 정보를 조회합니다.

### 요청 파라미터 (Path)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | `string (UUID)` | ✅ | 공유 ID |

### 응답

```typescript
// 200 OK
PublicShareDetail
```

### fetch 예시

```typescript
async function getMySentShareDetail(
  token: string,
  shareId: string,
): Promise<PublicShareDetail> {
  const res = await fetch(
    `/v1/file-shares/my-shares/${shareId}`,
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
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "fileId": "550e8400-e29b-41d4-a716-446655440010",
  "ownerId": "550e8400-e29b-41d4-a716-446655440002",
  "externalUserId": "770e8400-e29b-41d4-a716-446655440001",
  "permissions": ["VIEW", "DOWNLOAD"],
  "maxViewCount": 10,
  "currentViewCount": 3,
  "maxDownloadCount": 5,
  "currentDownloadCount": 1,
  "expiresAt": "2026-03-01T23:59:59.000Z",
  "isBlocked": false,
  "isRevoked": false,
  "createdAt": "2026-02-12T09:00:00.000Z",
  "updatedAt": "2026-02-12T09:00:00.000Z",
  "blockedAt": null,
  "blockedBy": null
}
```

---

## 6. 공유 철회

### `POST /v1/file-shares/my-shares/:id/revoke`

ACTIVE 상태의 공유(PublicShare)를 철회합니다. 철회 후 외부 사용자의 접근이 차단됩니다.

### 요청 파라미터 (Path)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | `string (UUID)` | ✅ | 철회할 공유 ID |

### 요청 Body

없음

### 응답

```typescript
// 200 OK
RevokeShareResponse
```

### fetch 예시

```typescript
async function revokeMySentShare(
  token: string,
  shareId: string,
): Promise<RevokeShareResponse> {
  const res = await fetch(
    `/v1/file-shares/my-shares/${shareId}/revoke`,
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
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "isRevoked": true
}
```

---

## 7. 에러 처리

### 공통 에러

| HTTP 상태 | 설명 | 대응 방법 |
|-----------|------|-----------|
| `401` | 인증 실패 (토큰 없음/만료) | 로그인 페이지로 리다이렉트 |

### 공유 상세 조회 에러

| HTTP 상태 | 설명 | 대응 방법 |
|-----------|------|-----------|
| `404` | 공유를 찾을 수 없음 | 목록으로 돌아가기, 새로고침 |

### 공유 철회 에러

| HTTP 상태 | 설명 | 대응 방법 |
|-----------|------|-----------|
| `400` | 철회할 수 없는 상태 (이미 철회됨) | 목록 새로고침 후 상태 확인 안내 |
| `403` | 본인이 소유한 공유만 철회 가능 | 권한 오류 메시지 표시 |
| `404` | 공유를 찾을 수 없음 | 목록 새로고침 |

### 에러 처리 예시

```typescript
async function handleRevokeShare(token: string, shareId: string) {
  try {
    const result = await revokeMySentShare(token, shareId);
    // 성공: 목록 새로고침 또는 아이템 상태를 REVOKED로 업데이트
    return result;
  } catch (error) {
    if (error instanceof Response) {
      switch (error.status) {
        case 400:
          alert('이미 철회된 공유입니다.');
          break;
        case 403:
          alert('본인이 소유한 공유만 철회할 수 있습니다.');
          break;
        case 404:
          alert('공유를 찾을 수 없습니다.');
          break;
      }
    }
    throw error;
  }
}
```

---

## 8. cURL 테스트

### 공유 목록 조회

```bash
# 전체 목록
curl -X GET "http://localhost:3000/v1/file-shares/my-shares" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ACTIVE 상태만
curl -X GET "http://localhost:3000/v1/file-shares/my-shares?status=ACTIVE&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# REVOKED 상태만
curl -X GET "http://localhost:3000/v1/file-shares/my-shares?status=REVOKED" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 공유 상세 조회

```bash
curl -X GET "http://localhost:3000/v1/file-shares/my-shares/660e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 공유 철회

```bash
curl -X POST "http://localhost:3000/v1/file-shares/my-shares/660e8400-e29b-41d4-a716-446655440001/revoke" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```
