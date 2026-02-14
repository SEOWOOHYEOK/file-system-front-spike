# 감사 로그 요약 조회 API

> `GET /v1/admin/audit-logs/summary`
>
> 이벤트 타입별, 결과별 카운트를 반환합니다.

---

## 기본 정보

| 항목   | 값                                    |
| ------ | ------------------------------------- |
| URL    | `GET /v1/admin/audit-logs/summary`    |
| 인증   | Bearer Token (JWT) 필수               |
| 권한   | `AUDIT_READ` 권한 필요                |

---

## Query Parameters

모든 파라미터는 **선택(optional)** 입니다. 아무것도 전달하지 않으면 전체 데이터에 대한 요약을 반환합니다.

| 파라미터     | 타입              | 필수 | 설명              | 예시                                     |
| ------------ | ----------------- | ---- | ----------------- | ---------------------------------------- |
| `userId`     | `string (UUID)`   | X    | 특정 사용자 필터  | `550e8400-e29b-41d4-a716-446655440000`   |
| `userType`   | `enum`            | X    | 사용자 유형       | `INTERNAL` \| `EXTERNAL`                 |
| `action`     | `enum`            | X    | 감사 액션 코드    | `FILE_DOWNLOAD`, `LOGIN_SUCCESS` 등      |
| `targetType` | `enum`            | X    | 대상 리소스 타입  | `FILE`, `FOLDER`, `SHARE` 등             |
| `targetId`   | `string (UUID)`   | X    | 대상 리소스 ID    | `550e8400-e29b-41d4-a716-446655440000`   |
| `result`     | `enum`            | X    | 결과 상태         | `SUCCESS` \| `FAIL`                      |
| `ipAddress`  | `string (IP)`     | X    | 클라이언트 IP     | `192.168.0.10`                           |
| `startDate`  | `string (ISO 8601)` | X | 조회 시작일       | `2026-01-01T00:00:00.000Z`               |
| `endDate`    | `string (ISO 8601)` | X | 조회 종료일       | `2026-02-14T23:59:59.000Z`               |

---

## Enum 상세

### userType

| 값         | 설명        |
| ---------- | ----------- |
| `INTERNAL` | 내부 사용자 |
| `EXTERNAL` | 외부 사용자 |

### targetType

| 값                    | 설명           |
| --------------------- | -------------- |
| `FILE`                | 파일           |
| `FOLDER`              | 폴더           |
| `SHARE`               | 공유           |
| `USER`                | 사용자         |
| `FAVORITE`            | 즐겨찾기       |
| `ACTIVITY`            | 활동           |
| `SYSTEM`              | 시스템         |
| `FILE_ACTION_REQUEST` | 파일 작업 요청 |

### result

| 값        | 설명 |
| --------- | ---- |
| `SUCCESS` | 성공 |
| `FAIL`    | 실패 |

### action (전체 56개)

<details>
<summary>펼쳐보기</summary>

| 값 | 설명 | 카테고리 |
| -- | ---- | -------- |
| `FILE_VIEW` | 파일 조회 | file |
| `FILE_DOWNLOAD` | 파일 다운로드 | file |
| `FILE_UPLOAD` | 파일 업로드 | file |
| `FILE_RENAME` | 파일 이름 변경 | file |
| `FILE_MOVE` | 파일 이동 | file |
| `FILE_DELETE` | 파일 삭제 (휴지통 이동) | file |
| `FILE_RESTORE` | 파일 복원 | file |
| `FILE_PURGE` | 파일 영구 삭제 | file |
| `FOLDER_CREATE` | 폴더 생성 | folder |
| `FOLDER_VIEW` | 폴더 조회 | folder |
| `FOLDER_RENAME` | 폴더 이름 변경 | folder |
| `FOLDER_MOVE` | 폴더 이동 | folder |
| `FOLDER_DELETE` | 폴더 삭제 | folder |
| `SHARE_CREATE` | 공유 링크 생성 | share |
| `SHARE_REVOKE` | 공유 링크 해제 | share |
| `SHARE_ACCESS` | 공유 링크 접근 | share |
| `SHARE_DOWNLOAD` | 공유 파일 다운로드 | share |
| `SHARE_BLOCK` | 공유 링크 차단 | share |
| `SHARE_UNBLOCK` | 공유 링크 차단 해제 | share |
| `SHARE_BULK_BLOCK` | 공유 일괄 차단 | share |
| `SHARE_BULK_UNBLOCK` | 공유 일괄 차단 해제 | share |
| `SHARE_REQUEST_CREATE` | 공유 요청 생성 | share |
| `SHARE_REQUEST_APPROVE` | 공유 요청 승인 | share |
| `SHARE_REQUEST_REJECT` | 공유 요청 거부 | share |
| `SHARE_REQUEST_CANCEL` | 공유 요청 취소 | share |
| `SHARE_REQUEST_BULK_APPROVE` | 공유 요청 일괄 승인 | share |
| `SHARE_REQUEST_BULK_REJECT` | 공유 요청 일괄 거부 | share |
| `PERMISSION_GRANT` | 권한 부여 | admin |
| `PERMISSION_REVOKE` | 권한 회수 | admin |
| `PERMISSION_CHANGE` | 권한 변경 | admin |
| `TRASH_EMPTY` | 휴지통 비우기 | file |
| `TRASH_VIEW` | 휴지통 조회 | file |
| `FAVORITE_ADD` | 즐겨찾기 등록 | user |
| `FAVORITE_REMOVE` | 즐겨찾기 해제 | user |
| `FAVORITE_VIEW` | 즐겨찾기 조회 | user |
| `ACTIVITY_VIEW` | 최근 활동 조회 | user |
| `EXTERNAL_USER_CREATE` | 외부 사용자 생성 | admin |
| `EXTERNAL_USER_UPDATE` | 외부 사용자 수정 | admin |
| `EXTERNAL_USER_DEACTIVATE` | 외부 사용자 비활성화 | admin |
| `EXTERNAL_USER_ACTIVATE` | 외부 사용자 활성화 | admin |
| `EXTERNAL_USER_PASSWORD_RESET` | 외부 사용자 비밀번호 초기화 | admin |
| `PASSWORD_CHANGE` | 비밀번호 변경 | security |
| `USER_ROLE_ASSIGN` | 사용자 Role 부여 | admin |
| `USER_ROLE_REMOVE` | 사용자 Role 제거 | admin |
| `USER_SYNC` | Employee → User 동기화 | admin |
| `TOKEN_GENERATE` | JWT 토큰 수동 생성 | security |
| `TOKEN_REFRESH` | 토큰 갱신 | security |
| `ORG_MIGRATION` | 조직 데이터 마이그레이션 | admin |
| `FILE_ACTION_REQUEST_MOVE_CREATE` | 파일 이동 요청 생성 | file |
| `FILE_ACTION_REQUEST_DELETE_CREATE` | 파일 삭제 요청 생성 | file |
| `FILE_ACTION_REQUEST_CANCEL` | 파일 작업 요청 취소 | file |
| `FILE_ACTION_REQUEST_APPROVE` | 파일 작업 요청 승인 | admin |
| `FILE_ACTION_REQUEST_REJECT` | 파일 작업 요청 반려 | admin |
| `FILE_ACTION_REQUEST_BULK_APPROVE` | 파일 작업 요청 일괄 승인 | admin |
| `FILE_ACTION_REQUEST_BULK_REJECT` | 파일 작업 요청 일괄 반려 | admin |
| `FILE_ACTION_REQUEST_INVALIDATED` | 파일 작업 요청 무효화 | file |
| `EXTERNAL_SHARE_DETAIL` | 외부 사용자 공유 상세 조회 | external |
| `EXTERNAL_SHARE_ACCESS` | 외부 사용자 파일 콘텐츠 접근 | external |
| `EXTERNAL_SHARE_DOWNLOAD` | 외부 사용자 파일 다운로드 | external |
| `LOGIN_SUCCESS` | 로그인 성공 | security |
| `LOGIN_FAILURE` | 로그인 실패 | security |
| `LOGOUT` | 로그아웃 | security |
| `TOKEN_EXPIRED` | 토큰 만료 | security |
| `PERMISSION_DENIED` | 권한 거부 | security |
| `EXPIRED_LINK_ACCESS` | 만료 링크 접근 | security |
| `BLOCKED_SHARE_ACCESS` | 차단된 공유 접근 | security |
| `ACCESS_PATTERN_DEVIATION` | 접근 패턴 이탈 | security |
| `NEW_DEVICE_ACCESS` | 신규 기기 접근 | security |

</details>

---

## Response

### 200 OK - 성공

#### TypeScript 인터페이스

```typescript
interface AuditLogSummary {
  /** 전체 로그 수 */
  total: number;

  /** 이벤트 타입(카테고리)별 카운트 */
  byEventType: EventTypeSummaryItem[];

  /** 결과 상태별 카운트 */
  byResult: ResultSummaryItem[];
}

interface EventTypeSummaryItem {
  /** 카테고리 코드 */
  category: 'file' | 'folder' | 'share' | 'auth' | 'admin' | 'user' | 'security' | 'external';
  /** 카테고리 한국어 라벨 */
  label: string;
  /** 해당 카테고리의 로그 수 */
  count: number;
}

interface ResultSummaryItem {
  /** 결과 코드 */
  result: 'SUCCESS' | 'FAIL';
  /** 결과 한국어 라벨 */
  label: string;
  /** 해당 결과의 로그 수 */
  count: number;
}
```

#### 응답 예시

```json
{
  "total": 1523,
  "byEventType": [
    { "category": "file",     "label": "파일",     "count": 680 },
    { "category": "folder",   "label": "폴더",     "count": 230 },
    { "category": "share",    "label": "공유",     "count": 180 },
    { "category": "security", "label": "보안",     "count": 150 },
    { "category": "admin",    "label": "관리자",   "count": 120 },
    { "category": "user",     "label": "사용자",   "count": 98 },
    { "category": "auth",     "label": "인증",     "count": 45 },
    { "category": "external", "label": "외부",     "count": 20 }
  ],
  "byResult": [
    { "result": "SUCCESS", "label": "성공", "count": 1400 },
    { "result": "FAIL",    "label": "실패", "count": 123 }
  ]
}
```

### 에러 응답

| Status | 설명 |
| ------ | ---- |
| `400`  | 잘못된 쿼리 파라미터 (UUID 형식 오류, 유효하지 않은 enum 값 등) |
| `401`  | 인증 실패 (토큰 없음 또는 만료) |
| `403`  | 권한 없음 (`AUDIT_READ` 권한 필요) |

---

## 프론트엔드 사용 예시

### axios

```typescript
import axios from 'axios';

interface AuditLogSummaryParams {
  userId?: string;
  userType?: 'INTERNAL' | 'EXTERNAL';
  action?: string;
  targetType?: string;
  targetId?: string;
  result?: 'SUCCESS' | 'FAIL';
  ipAddress?: string;
  startDate?: string;  // ISO 8601
  endDate?: string;    // ISO 8601
}

const getAuditLogSummary = async (
  params?: AuditLogSummaryParams,
): Promise<AuditLogSummary> => {
  const { data } = await axios.get('/v1/admin/audit-logs/summary', {
    params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
};
```

### 호출 예시

```typescript
// 1. 전체 요약 조회 (필터 없음)
const summary = await getAuditLogSummary();

// 2. 특정 기간 필터
const summary = await getAuditLogSummary({
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-02-14T23:59:59.000Z',
});

// 3. 특정 사용자의 실패 로그 요약
const summary = await getAuditLogSummary({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  result: 'FAIL',
});

// 4. 파일 대상만 필터
const summary = await getAuditLogSummary({
  targetType: 'FILE',
});

// 5. 내부 사용자 + 특정 기간
const summary = await getAuditLogSummary({
  userType: 'INTERNAL',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-02-14T23:59:59.000Z',
});
```

---

## 참고

- 모든 날짜는 **ISO 8601** 형식 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- UUID는 **v4** 형식 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- `byEventType`의 `category`는 각 `action`이 속한 카테고리로 자동 분류됨
- 필터를 조합하면 AND 조건으로 동작 (예: `userId` + `result` → 해당 사용자의 해당 결과만 집계)
