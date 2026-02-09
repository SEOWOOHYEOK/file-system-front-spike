// types/observability.ts
// NAS Observability 대시보드 타입 정의

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
