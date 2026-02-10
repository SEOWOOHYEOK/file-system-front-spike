ㄹ# NAS Observability 대시보드 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `500.관리자` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [TypeScript 타입 정의](#2-typescript-타입-정의)
3. [API 상세 - 현재 상태 조회](#3-api-상세---현재-상태-조회)
4. [API 상세 - 상태 이력 조회](#4-api-상세---상태-이력-조회)
5. [API 상세 - 설정 조회](#5-api-상세---설정-조회)
6. [API 상세 - 설정 변경](#6-api-상세---설정-변경)
7. [대시보드 UI 매핑 가이드](#7-대시보드-ui-매핑-가이드)
8. [유틸리티 함수](#8-유틸리티-함수)
9. [폴링 (자동 새로고침) 구현](#9-폴링-자동-새로고침-구현)
10. [에러 처리](#10-에러-처리)

---

## 1. API 개요

| Method | Path | 설명 | 용도 |
|--------|------|------|------|
| `GET` | `/v1/admin/observability/current` | 현재 NAS 상태 (실시간) | Storage Usage 카드, System Information 섹션 |
| `GET` | `/v1/admin/observability/history?hours=24` | 상태 이력 + 정상 비율 | System Status 카드, 24H 타임라인 차트 |
| `GET` | `/v1/admin/observability/settings` | 설정 조회 | 설정 화면 초기 로딩 |
| `PUT` | `/v1/admin/observability/settings` | 설정 변경 | 설정 변경 폼 제출 |

### 대시보드 초기 로딩 시 호출 순서

```
1. GET /current   → Storage Usage 카드 + System Information 렌더링
2. GET /history   → System Status 카드 + 타임라인 차트 렌더링
3. GET /settings  → 임계치(thresholdPercent) 가져와서 도넛 차트에 표시
```

> `current`와 `history`는 **병렬 호출** 가능합니다. `settings`도 병렬 가능하지만, 임계치만 필요하면 초기 한 번만 호출하면 됩니다.

---

## 2. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/observability.ts

// ─── 응답 타입 ───

/** GET /v1/admin/observability/current 응답 */
export interface ObservabilityCurrent {
  /** 스토리지 상태 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 응답 시간 (ms) */
  responseTimeMs: number;
  /** 확인 시각 (ISO 8601) */
  checkedAt: string;
  /** 전체 용량 (bytes) - healthy/degraded 시에만 존재 */
  totalBytes?: number;
  /** 사용 용량 (bytes) - healthy/degraded 시에만 존재 */
  usedBytes?: number;
  /** 여유 용량 (bytes) - healthy/degraded 시에만 존재 */
  freeBytes?: number;
  /** 사용률 (%) - healthy/degraded 시에만 존재 */
  usagePercent?: number;
  /** 서버명 - UNC 경로에서 추출 (예: "Portal-NAS-01") */
  serverName?: string;
  /** 에러 메시지 - unhealthy 시에만 존재 */
  error?: string;
}

/** 이력 항목 */
export interface ObservabilityHistoryItem {
  /** 체크 당시 상태 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 응답 시간 (ms) */
  responseTimeMs: number;
  /** 전체 용량 (bytes) */
  totalBytes: number;
  /** 사용 용량 (bytes) */
  usedBytes: number;
  /** 체크 시각 (ISO 8601) */
  checkedAt: string;
}

/** GET /v1/admin/observability/history 응답 */
export interface ObservabilityHistory {
  /** 이력 데이터 (시간순 ASC 정렬) */
  items: ObservabilityHistoryItem[];
  /** 조회 기간 (시간) */
  hours: number;
  /** 전체 이력 건수 */
  totalCount: number;
  /** 정상 비율 (%) */
  healthyPercent: number;
  /** 정상 시간 (시간) */
  healthyHours: number;
  /** 비정상 시간 (시간) */
  unhealthyHours: number;
}

/** GET /v1/admin/observability/settings 응답 */
export interface ObservabilitySettings {
  /** 헬스체크 주기 (분) */
  intervalMinutes: number;
  /** 이력 보존 기간 (일) */
  retentionDays: number;
  /** 스토리지 사용률 임계치 (%) */
  thresholdPercent: number;
}

// ─── 요청 타입 ───

/** PUT /v1/admin/observability/settings 요청 (부분 업데이트) */
export interface UpdateObservabilitySettings {
  /** 헬스체크 주기 (분) - 1~60 */
  intervalMinutes?: number;
  /** 이력 보존 기간 (일) - 1~365 */
  retentionDays?: number;
  /** 스토리지 사용률 임계치 (%) - 50~99 */
  thresholdPercent?: number;
}
```

---

## 3. API 상세 - 현재 상태 조회

### 요청

```
GET /v1/admin/observability/current
```

파라미터 없음.

### 응답 예시 - 정상 (healthy)

```json
{
  "status": "healthy",
  "responseTimeMs": 45,
  "checkedAt": "2026-02-09T09:10:00.000Z",
  "totalBytes": 999893999616,
  "usedBytes": 449952149504,
  "freeBytes": 549941850112,
  "usagePercent": 45.0,
  "serverName": "Portal-NAS-01"
}
```

### 응답 예시 - 비정상 (unhealthy)

```json
{
  "status": "unhealthy",
  "responseTimeMs": 10023,
  "checkedAt": "2026-02-09T09:15:00.000Z",
  "error": "No mapped drive found for UNC path"
}
```

> **주의:** unhealthy 시에는 `totalBytes`, `usedBytes`, `freeBytes`, `usagePercent`, `serverName`이 모두 없습니다.

### fetch 예시

```typescript
const res = await fetch('/v1/admin/observability/current');
const data: ObservabilityCurrent = await res.json();

if (data.status === 'unhealthy') {
  // 에러 UI 표시
  console.error(data.error);
} else {
  // 정상: 용량 정보 사용
  console.log(`${data.usagePercent}% 사용 중`);
}
```

---

## 4. API 상세 - 상태 이력 조회

### 요청

```
GET /v1/admin/observability/history?hours=24
```

| 파라미터 | 타입 | 필수 | 기본값 | 범위 | 설명 |
|----------|------|------|--------|------|------|
| `hours` | number | X | 24 | 1~168 | 조회할 시간 범위 |

### 응답 예시

```json
{
  "items": [
    {
      "status": "healthy",
      "responseTimeMs": 42,
      "totalBytes": 999893999616,
      "usedBytes": 449952149504,
      "checkedAt": "2026-02-08T09:15:00.000Z"
    },
    {
      "status": "healthy",
      "responseTimeMs": 38,
      "totalBytes": 999893999616,
      "usedBytes": 449960000000,
      "checkedAt": "2026-02-08T09:20:00.000Z"
    },
    {
      "status": "unhealthy",
      "responseTimeMs": 0,
      "totalBytes": 0,
      "usedBytes": 0,
      "checkedAt": "2026-02-08T15:30:00.000Z"
    }
  ],
  "hours": 24,
  "totalCount": 288,
  "healthyPercent": 75.0,
  "healthyHours": 18.0,
  "unhealthyHours": 6.0
}
```

### 정상 비율 계산 규칙

| 상태 | 분류 |
|------|------|
| `healthy` | 정상 |
| `degraded` | 정상 (느리지만 연결됨) |
| `unhealthy` | **비정상** |

### fetch 예시

```typescript
const res = await fetch('/v1/admin/observability/history?hours=24');
const data: ObservabilityHistory = await res.json();

console.log(`정상 비율: ${data.healthyPercent}%`);
console.log(`정상 ${data.healthyHours}h / 비정상 ${data.unhealthyHours}h`);
```

---

## 5. API 상세 - 설정 조회

### 요청

```
GET /v1/admin/observability/settings
```

### 응답 예시

```json
{
  "intervalMinutes": 5,
  "retentionDays": 7,
  "thresholdPercent": 80
}
```

> 설정을 한 번도 변경하지 않았어도 기본값이 반환됩니다.

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `intervalMinutes` | 5 | 헬스체크 주기 (분). 스케줄러가 이 간격으로 NAS 상태를 체크 |
| `retentionDays` | 7 | 이력 보존 기간 (일). 초과 이력은 매일 자정에 자동 삭제 |
| `thresholdPercent` | 80 | 도넛 차트에 빨간 임계선으로 표시 |

---

## 6. API 상세 - 설정 변경

### 요청

```
PUT /v1/admin/observability/settings
Content-Type: application/json
```

**부분 업데이트 가능** -- 변경할 필드만 보내면 됩니다.

### 요청 예시 - 주기만 변경

```json
{ "intervalMinutes": 10 }
```

### 요청 예시 - 전체 변경

```json
{
  "intervalMinutes": 10,
  "retentionDays": 30,
  "thresholdPercent": 90
}
```

### 응답 예시

변경 후 **전체 설정**이 반환됩니다.

```json
{
  "intervalMinutes": 10,
  "retentionDays": 30,
  "thresholdPercent": 90
}
```

### Validation 규칙

| 필드 | 타입 | 최소 | 최대 |
|------|------|------|------|
| `intervalMinutes` | number | 1 | 60 |
| `retentionDays` | number | 1 | 365 |
| `thresholdPercent` | number | 50 | 99 |

### 에러 응답 (400)

```json
{
  "statusCode": 400,
  "message": ["intervalMinutes must not be greater than 60"],
  "error": "Bad Request"
}
```

### fetch 예시

```typescript
const res = await fetch('/v1/admin/observability/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ intervalMinutes: 10 }),
});
const data: ObservabilitySettings = await res.json();
```

> 주기 변경 시 서버 재시작 없이 **최대 1분 이내에 반영**됩니다.

---

## 7. 대시보드 UI 매핑 가이드

스크린샷 기준으로 각 UI 요소가 어떤 API의 어떤 필드를 사용하는지 정리합니다.

### Storage Usage 카드 (왼쪽)

**API:** `GET /current` + `GET /settings`

```
┌─────────────────────────────────────┐
│ STORAGE USAGE                       │
│ 45.0%  419.1 GB / 931.3 GB         │
│                                     │
│        ┌──────┐                     │
│       /  도넛  \                    │
│      │  차트    │                   │
│       \________/                    │
│                                     │
│  ● 사용량  ● 여유 공간  ● 임계치 80%│
└─────────────────────────────────────┘
```

| UI 요소 | 값 계산 |
|---------|---------|
| `45.0%` | `current.usagePercent` |
| `419.1 GB` | `formatBytes(current.usedBytes)` |
| `931.3 GB` | `formatBytes(current.totalBytes)` |
| 도넛 - 사용량 | `current.usedBytes` |
| 도넛 - 여유 공간 | `current.freeBytes` |
| 도넛 - 임계치 선 | `settings.thresholdPercent` (80% 위치에 빨간선) |

### System Status 카드 (오른쪽)

**API:** `GET /history?hours=24`

```
┌──────────────────────────────────────────┐
│ SYSTEM STATUS (24H)                      │
│ 75%  (18h 정상 / 6h 비정상)               │
│                                          │
│  1 ─────┐     ┌───┐       ┌─────────    │
│          │     │   │       │             │
│  0       └─────┘   └───────┘             │
│     0:00    6:00    12:00    18:00       │
│                                          │
│  ● 시스템 상태 (1=정상, 0=비정상)          │
└──────────────────────────────────────────┘
```

| UI 요소 | 값 계산 |
|---------|---------|
| `75%` | `history.healthyPercent` |
| `18h 정상` | `history.healthyHours` + `h 정상` |
| `6h 비정상` | `history.unhealthyHours` + `h 비정상` |
| 타임라인 X축 | `history.items[].checkedAt` |
| 타임라인 Y축 | `item.status !== 'unhealthy' ? 1 : 0` |

#### 타임라인 차트 데이터 변환

```typescript
const chartData = history.items.map(item => ({
  time: new Date(item.checkedAt),
  value: item.status !== 'unhealthy' ? 1 : 0,
  label: item.status !== 'unhealthy' ? '정상' : '비정상',
}));
```

### System Information 섹션

**API:** `GET /current`

```
┌──────────────────────────────────────────┐
│ System Information                       │
│                                          │
│ SERVER NAME          STATUS              │
│ Portal-NAS-01        ● Online            │
│                                          │
│ TOTAL CAPACITY       USED SPACE          │
│ 931.3 GB             419.1 GB            │
│                                          │
│ LAST CHECKED                             │
│ 오전 09:10                                │
└──────────────────────────────────────────┘
```

| UI 요소 | 값 계산 |
|---------|---------|
| SERVER NAME | `current.serverName` (없으면 `"Unknown"`) |
| STATUS | `current.status === 'unhealthy' ? 'Offline' : 'Online'` |
| STATUS 색상 | `status === 'Online' ? 'green' : 'red'` |
| TOTAL CAPACITY | `formatBytes(current.totalBytes)` |
| USED SPACE | `formatBytes(current.usedBytes)` |
| LAST CHECKED | `formatTime(current.checkedAt)` |

---

## 8. 유틸리티 함수

### 바이트 포맷팅

```typescript
/**
 * bytes → "419.1 GB" 형식으로 변환
 */
function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

// 예시:
// formatBytes(449952149504)  → "419.1 GB"
// formatBytes(999893999616)  → "931.3 GB"
```

### 시간 포맷팅

```typescript
/**
 * ISO 8601 → "오전 09:10" 형식으로 변환
 */
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 예시:
// formatTime("2026-02-09T09:10:00.000Z")  → "오후 06:10" (KST)
```

### 상태 → Online/Offline 매핑

```typescript
function getStatusDisplay(status: string): { label: string; color: string } {
  if (status === 'unhealthy') {
    return { label: 'Offline', color: '#ef4444' }; // red
  }
  if (status === 'degraded') {
    return { label: 'Degraded', color: '#f59e0b' }; // amber
  }
  return { label: 'Online', color: '#22c55e' }; // green
}
```

### 사용률 → 색상 매핑

```typescript
function getUsageColor(usagePercent: number, threshold: number): string {
  if (usagePercent >= threshold) return '#ef4444';  // red - 임계치 초과
  if (usagePercent >= threshold * 0.9) return '#f59e0b'; // amber - 임계치 근접
  return '#3b82f6'; // blue - 정상
}

// 예시:
// getUsageColor(45, 80)  → '#3b82f6' (blue, 정상)
// getUsageColor(75, 80)  → '#f59e0b' (amber, 근접)
// getUsageColor(85, 80)  → '#ef4444' (red, 초과)
```

---

## 9. 폴링 (자동 새로고침) 구현

### React 예시

```typescript
import { useState, useEffect, useCallback } from 'react';

function useObservabilityPolling(intervalMs = 60_000) {
  const [current, setCurrent] = useState<ObservabilityCurrent | null>(null);
  const [history, setHistory] = useState<ObservabilityHistory | null>(null);
  const [settings, setSettings] = useState<ObservabilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // current와 history 병렬 호출
      const [currentRes, historyRes] = await Promise.all([
        fetch('/v1/admin/observability/current'),
        fetch('/v1/admin/observability/history?hours=24'),
      ]);

      if (!currentRes.ok || !historyRes.ok) {
        throw new Error('API 호출 실패');
      }

      setCurrent(await currentRes.json());
      setHistory(await historyRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 설정은 한 번만 로드
  useEffect(() => {
    fetch('/v1/admin/observability/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch(console.error);
  }, []);

  // 폴링
  useEffect(() => {
    fetchData(); // 초기 로딩

    const timer = setInterval(fetchData, intervalMs);
    return () => clearInterval(timer);
  }, [fetchData, intervalMs]);

  return { current, history, settings, loading, error, refetch: fetchData };
}
```

### 사용 예시

```tsx
function ObservabilityDashboard() {
  const { current, history, settings, loading, error } = useObservabilityPolling(60_000);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <StorageUsageCard current={current} threshold={settings?.thresholdPercent ?? 80} />
      <SystemStatusCard history={history} />
      <SystemInfoSection current={current} />
    </div>
  );
}
```

### 폴링 권장 간격

| 항목 | 권장 간격 | 이유 |
|------|----------|------|
| `current` | 60초 | 실시간 상태는 자주 볼수록 좋지만, 서버 부하 고려 |
| `history` | 5분 | 이력 데이터는 스케줄러 주기(기본 5분)에 맞춰 |
| `settings` | 초기 1회 | 자주 변경되지 않으므로 |

---

## 10. 에러 처리

### HTTP 상태 코드

| 코드 | 의미 | 대응 |
|------|------|------|
| `200` | 성공 | 정상 처리 |
| `400` | Validation 에러 | 입력값 범위 확인 (설정 변경 시) |
| `500` | 서버 오류 | "서버 연결에 실패했습니다" 표시 |

### NAS 상태별 UI 처리

```typescript
function renderStatusUI(current: ObservabilityCurrent) {
  switch (current.status) {
    case 'healthy':
      // 정상: 모든 정보 표시
      return renderFullDashboard(current);

    case 'degraded':
      // 성능 저하: 모든 정보 표시 + 경고 배너
      return (
        <>
          <WarningBanner message={`응답 시간이 느립니다 (${current.responseTimeMs}ms)`} />
          {renderFullDashboard(current)}
        </>
      );

    case 'unhealthy':
      // 연결 불가: 에러 메시지 + 마지막 정상 이력 표시
      return (
        <>
          <ErrorBanner message={current.error || 'NAS 연결에 실패했습니다'} />
          <SystemInfoSection current={current} />
          {/* totalBytes 등이 없으므로 Storage Usage 카드는 빈 상태로 */}
        </>
      );
  }
}
```

### 이력 데이터가 없는 경우

서버 최초 시작 후 아직 스케줄러가 한 번도 실행되지 않았을 때:

```json
{
  "items": [],
  "hours": 24,
  "totalCount": 0,
  "healthyPercent": 100,
  "healthyHours": 24,
  "unhealthyHours": 0
}
```

> `totalCount === 0`이면 "아직 수집된 이력이 없습니다. 헬스체크 주기에 따라 데이터가 쌓입니다." 안내를 표시하세요.

---

## 부록: cURL로 직접 테스트하기

```bash
# 현재 상태 조회
curl http://localhost:3000/v1/admin/observability/current | jq

# 24시간 이력 조회
curl http://localhost:3000/v1/admin/observability/history?hours=24 | jq

# 설정 조회
curl http://localhost:3000/v1/admin/observability/settings | jq

# 설정 변경 (주기를 10분으로)
curl -X PUT http://localhost:3000/v1/admin/observability/settings \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 10}' | jq

# 설정 전체 변경
curl -X PUT http://localhost:3000/v1/admin/observability/settings \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 10, "retentionDays": 30, "thresholdPercent": 90}' | jq
```
