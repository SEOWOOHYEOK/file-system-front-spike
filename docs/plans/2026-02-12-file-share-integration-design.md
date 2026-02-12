# 파일 공유 기능 통합 설계 (600·700·701·702·710)

> 작성일: 2026-02-12
> 기반 문서: `api-guide-file-share.md`

---

## 1. 요약

- **700/701/702**: `/my-files` 페이지에 통합
- **710**: 별도 `ExternalSharePage`로 새로 작성
- 기존 관리자 API(520)는 건드리지 않음
- 신규 파일로 타입/API 분리 (`file-share.types.ts`, `fileShareApi.ts`)

---

## 2. 결정 사항

| 항목 | 결정 |
|------|------|
| 700 공유 요청 생성 | 기존 모달 방식 유지, 새 API + designatedApproverId 플로우 반영 |
| 701 보낸 공유 | MyFilesPage 사이드바에 "내가 공유한 파일" 뷰 추가 |
| 702 받은 요청 | MyFilesPage 사이드바에 "받은 요청" (상태별 카운트) 추가, 목록+상세 패널(split view) |
| 710 외부 접근 | `/external` 페이지 완전 새로 작성 |
| 파일 구조 | 신규 파일 생성 (기존 관리자 API와 분리) |

---

## 3. 파일 구조

### 신규 생성

```
src/
├── types/
│   └── file-share.types.ts          # 600/700/701/702/710 전체 타입
├── api/
│   └── fileShareApi.ts              # 600/700/701/702 사용자용 API 클라이언트
├── components/files/
│   ├── SentSharesView.tsx           # 701 - 보낸 공유 통합 목록 뷰
│   ├── SentShareDetail.tsx          # 701 - 공유 상세 (PublicShare)
│   ├── ReceivedRequestsView.tsx     # 702 - 받은 요청 목록 + 상세 패널
│   └── ReceivedRequestDetail.tsx    # 702 - 받은 요청 상세 패널 (승인/반려)
├── pages/
│   └── ExternalSharePage.tsx        # 710 - 외부 사용자 파일 접근
```

### 수정

```
src/
├── components/files/
│   ├── FileSidebar.tsx              # 사이드바에 공유 관리 메뉴 추가
│   ├── ShareRequestModal.tsx        # 700 - 새 API + 승인자 선택 플로우
│   └── index.ts                     # 새 컴포넌트 export
├── pages/
│   └── MyFilesPage.tsx              # ViewType 확장, 새 뷰 렌더링
├── App.tsx                          # /external 라우트 교체
├── api/
│   └── externalShareApi.ts          # 710 엔드포인트 경로 변경
```

### 미변경

```
src/
├── api/shareRequestApi.ts           # 기존 관리자 API (520) 유지
├── types/share-request.types.ts     # 기존 관리자 타입 유지
```

---

## 4. 타입 정의 (`file-share.types.ts`)

API 가이드 Section 3의 타입을 그대로 사용한다.

### 핵심 타입

- **Enum**: `ShareTargetUserType`, `ShareTargetType`, `SharePermissionType`, `ShareRequestStatus`, `MySentShareStatus`, `AvailabilityStatus`, `MySentShareSource`
- **600**: `PermissionItem`, `PermissionGroup`, `MyPermissionResponse`
- **Enriched**: `FileDetail`, `InternalUserDetail`, `ExternalUserDetail`, `UserDetail`, `EnrichedShareTarget`
- **700**: `ShareTarget`, `SharePermission`, `ShareTargetUser`, `ApproverResponse`, `CheckAvailabilityRequest/Response`, `CreateShareRequestRequest`, `ShareRequestResponse`
- **701**: `MySentShareItem`, `PublicShareResponse`, `RevokeShareResponse`
- **702**: `ApproveReceivedRequestBody`, `RejectReceivedRequestBody`
- **710**: `MyShareListItem`, `ShareDetail`, `ShareDetailResponse`
- **공통**: `PaginatedResponse<T>`

### Enriched 필드 (ShareRequestResponse)

`files`, `requesterDetail`, `targetDetails`, `designatedApproverDetail`, `approverDetail`이 항상 포함됨. 추가 API 호출 없이 UI 렌더링 가능.

---

## 5. API 클라이언트 (`fileShareApi.ts`)

```typescript
// 600. 나의 권한
export const permissionApi = {
  getMyPermissions(token)          // GET /v1/users/me/permissions
}

// 700. 공유 요청 생성
export const fileShareRequestApi = {
  searchUsers(token, params)       // GET /v1/file-shares-requests/users
  searchApprovers(token, params)   // GET /v1/file-shares-requests/approvers
  checkAvailability(token, data)   // POST /v1/file-shares-requests/requests/check-availability
  create(token, data)              // POST /v1/file-shares-requests/requests
}

// 701. 보낸 공유 관리
export const mySentShareApi = {
  getList(token, params)           // GET /v1/file-shares-requests
  getDetail(token, id)             // GET /v1/file-shares-requests/:id
  cancel(token, id)                // POST /v1/file-shares-requests/:id/cancel
}

// 702. 받은 요청 관리
export const receivedRequestApi = {
  getList(token, params)           // GET /v1/file-shares-requests/received
  getDetail(token, id)             // GET /v1/file-shares-requests/received/:id
  approve(token, id, body?)        // POST /v1/file-shares-requests/received/:id/approve
  reject(token, id, body)          // POST /v1/file-shares-requests/received/:id/reject
}
```

### 에러 처리

- 도메인별 에러 코드 (2001~2018) 타입화
- `mySentShareApi.cancel()` 응답: `'isRevoked' in data`로 `RevokeShareResponse | ShareRequestResponse` 타입 가드

---

## 6. UI 컴포넌트 설계

### 6.1 사이드바 구조 (FileSidebar 확장)

```
전체 파일
최근
즐겨찾기
휴지통
─────────────────
파일 공유 관리
  내 공유 관리 (접기/펼치기)
    내가 공유한 파일 (N)
  받은 요청
    대기 중   (N)
    승인함    (N)
    반려함    (N)
```

### 6.2 700 공유 요청 모달 (ShareRequestModal 업데이트)

파일 선택 → 모달 열림 → 권한 확인 기반 플로우:

```
⓪ permissionApi.getMyPermissions()
   → hasDirectShare = permissions.includes('FILE_SHARE_DIRECT')

Step 1: 대상자 선택
   → fileShareRequestApi.searchUsers() (내부/외부 필터, 검색)
   → 다중 선택

Step 2: 승인자 선택 (hasDirectShare === false일 때만)
   → fileShareRequestApi.searchApprovers() (키워드 검색)
   → 단일 선택
   → hasDirectShare === true이면 스킵 + "즉시 공유됩니다" 배너

Step 3: 권한/기간/사유 입력
   → permission.type: VIEW / DOWNLOAD
   → DOWNLOAD 시 maxDownloads (선택)
   → startAt, endAt
   → reason

Step 4: 가용성 확인 + 제출
   → fileShareRequestApi.checkAvailability()
   → 충돌 시: 충돌 항목 표시
   → 가용 시: fileShareRequestApi.create()
   → isAutoApproved에 따라 성공 메시지 분기
```

### 6.3 701 보낸 공유 뷰 (SentSharesView)

내가 공유한 파일 테이블:

| 컬럼 | ShareRequest (PENDING) | PublicShare (ACTIVE 등) |
|------|----------------------|----------------------|
| 상태 | 승인대기 / 반려 / 취소 | 활성 / 만료 / 비활성 |
| 파일명 | files[].name | fileId → 파일명 |
| 공유 대상 | targetDetails[].userDetail.name | externalUserId → 이름 |
| 공유 권한 | permission.type | permissions[] |
| 다운로드 | - (미생성) | currentDownloadCount / maxDownloadCount |
| 공유일 | requestedAt | createdAt |
| 열람기간 | startAt ~ endAt + 잔여일 | expiresAt + 잔여일 |
| 접근 횟수 | - | currentViewCount |
| 공유 출처 | isAutoApproved ? "직접 공유" : "요청 승인 {승인자명}" | 동일 |
| 액션 | 취소 | 철회 |

상태 배지:

| 상태 | UI 표시 | 색상 |
|------|---------|------|
| PENDING | 승인대기 | 노란색 |
| ACTIVE | 활성 | 파란색 |
| APPROVED | 승인됨 | 초록색 |
| REJECTED | 반려 | 빨간색 |
| CANCELED | 취소 | 회색 |
| REVOKED | 비활성 | 회색 |
| (expiresAt < now) | 만료 | 회색 (프론트 판별) |

### 6.4 702 받은 요청 뷰 (ReceivedRequestsView)

목록 + 오른쪽 상세 패널 (split view):

**좌측 목록 카드:**
- 대표 파일명 + "외 N건" (`files[0].name` 외 `files.length - 1`건)
- 요청자명 (부서) · 수신자 N명 (`requesterDetail.name` + `targetDetails.length`명)
- 요청일 + [대기중] 배지

**우측 상세 패널:**
1. 헤더: 요청자 아바타 + 이름(부서) + 요청일 + [승인] [반려] 버튼
2. 사유: 인용 블록 스타일 (`reason`)
3. 파일 목록 (N건): 파일명 + MIME타입 아이콘 (`files[]`)
4. 공유 대상 (N명): 아바타 + 이름 + 이메일 + 소속 (`targetDetails[].userDetail`)
5. 요청 권한: 타입(다운로드 N회) + 기간(시작~종료, 잔여일수)

**동작:**
- 사이드바 상태 클릭 → 해당 status 필터 (PENDING/APPROVED/REJECTED)
- 승인 시: 코멘트 입력 (선택) → `receivedRequestApi.approve()`
- 반려 시: 코멘트 입력 (필수) → `receivedRequestApi.reject()`
- 성공 시 목록 새로고침 + 사이드바 카운트 업데이트

---

## 7. 710 외부 사용자 페이지 (ExternalSharePage)

기존 `/external` 페이지 완전 새로 작성. 외부 JWT 인증 기반.

### 페이지 구성

1. 공유 파일 목록 (`GET /v1/file-shares-requests/me`)
2. 파일 선택 → 상세 + contentToken 발급 (`GET /v1/file-shares-requests/:shareId`)
3. 뷰어 (`GET .../content?token={contentToken}`) → fetch blob → iframe
4. 다운로드 (`GET .../download?token={contentToken}`) → fetch blob → `<a download>`

### 엔드포인트 변경

- 기존: `/v1/ext/shares/...`
- 변경: `/v1/file-shares-requests/...`

### 토큰 재시도 로직

contentToken 일회성(60초) → 2112/2113 에러 시 상세 조회 재호출 → 새 토큰으로 자동 재시도 (`fetchWithTokenRetry` 유틸)

---

## 8. 주의사항

1. **701 & 710 동일 엔드포인트**: `GET /v1/file-shares-requests/:id`가 내부/외부 JWT에 따라 다른 응답 반환. API 모듈 분리로 타입 안정성 확보.
2. **Enriched 필드 optional**: `files`, `requesterDetail` 등은 `?`로 선언. 파일/사용자 삭제 시 누락 가능 → 프론트에서 fallback 표시 필요.
3. **기존 관리자 API 미변경**: `shareRequestApi.ts`, `share-request.types.ts`는 그대로 유지. 타입명 중복(ShareRequestStatus 등)은 import 경로로 구분.
