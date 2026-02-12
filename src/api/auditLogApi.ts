/**
 * 관리자 - 감사 로그 및 통합 타임라인 API
 * Swagger 태그: 806.관리자 - audit log 확인
 *
 * 두 개 컨트롤러:
 * - /admin/audit-logs (감사 로그)
 * - /v1/admin/timeline (통합 타임라인)
 */
import apiClient from './apiClient';
import type {
  AuditLog,
  AuditLogQueryParams,
  FileHistory,
  FileHistoryQueryParams,
  PaginatedResult,
  ObservabilityEvent,
  UnifiedTimelineResponse,
  TimelineQueryParams,
  EntityTimelineParams,
  TargetType,
} from '../types/audit-log.types';

// ─── 로그 콜백 ───

type LogCallback = (entry: { method: string; url: string; status: number; data: unknown }) => void;
let logCallback: LogCallback | null = null;

export function setAuditLogCallback(cb: LogCallback | null) {
  logCallback = cb;
}

function log(method: string, url: string, status: number, data: unknown) {
  logCallback?.({ method, url, status, data });
}

// ─── 유틸리티 ───

function buildQuery(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, String(v)));
    } else {
      query.set(key, String(value));
    }
  }
  return query.toString();
}

// ─── 감사 로그 API (/admin/audit-logs) ───
// 주의: 이 엔드포인트들은 /v1 프리픽스가 없으므로 baseURL을 오버라이드

const AUDIT_BASE = '';  // baseURL 오버라이드용

export const auditLogApi = {
  // ── 1. 감사 로그 목록 조회 ──
  async getAuditLogs(params: AuditLogQueryParams = {}): Promise<PaginatedResult<AuditLog>> {
    const qs = buildQuery(params);
    const url = `/v1/admin/audit-logs${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<PaginatedResult<AuditLog>>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 2. 감사 로그 상세 조회 ──
  async getAuditLog(id: string): Promise<AuditLog | null> {
    const url = `/v1/admin/audit-logs/${id}`;
    try {
      const { data } = await apiClient.get<AuditLog>(url, { baseURL: AUDIT_BASE });
      log('GET', url, 200, data);
      return data;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status: number } };
        if (axiosErr.response?.status === 404) return null;
      }
      throw err;
    }
  },

  // ── 3. 특정 사용자의 감사 로그 조회 ──
  async getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]> {
    const qs = limit ? `?limit=${limit}` : '';
    const url = `/v1/admin/audit-logs/user/${userId}${qs}`;
    const { data } = await apiClient.get<AuditLog[]>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 4. 특정 대상의 접근 이력 조회 ──
  async getAuditLogsByTarget(targetType: TargetType, targetId: string, limit?: number): Promise<AuditLog[]> {
    const qs = limit ? `?limit=${limit}` : '';
    const url = `/v1/admin/audit-logs/target/${targetType}/${targetId}${qs}`;
    const { data } = await apiClient.get<AuditLog[]>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 5. 특정 세션의 활동 로그 조회 ──
  async getAuditLogsBySession(sessionId: string): Promise<AuditLog[]> {
    const url = `/v1/admin/audit-logs/session/${sessionId}`;
    const { data } = await apiClient.get<AuditLog[]>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 6. 파일 이력 목록 조회 ──
  async getFileHistories(params: FileHistoryQueryParams = {}): Promise<PaginatedResult<FileHistory>> {
    const qs = buildQuery(params);
    const url = `/v1/admin/audit-logs/file-history${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<PaginatedResult<FileHistory>>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 7. 특정 파일의 변경 이력 조회 ──
  async getFileHistoryByFile(fileId: string, limit?: number): Promise<FileHistory[]> {
    const qs = limit ? `?limit=${limit}` : '';
    const url = `/v1/admin/audit-logs/file-history/file/${fileId}${qs}`;
    const { data } = await apiClient.get<FileHistory[]>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 8. 특정 파일의 특정 버전 조회 ──
  async getFileHistoryByVersion(fileId: string, version: number): Promise<FileHistory | null> {
    const url = `/v1/admin/audit-logs/file-history/file/${fileId}/version/${version}`;
    try {
      const { data } = await apiClient.get<FileHistory>(url, { baseURL: AUDIT_BASE });
      log('GET', url, 200, data);
      return data;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status: number } };
        if (axiosErr.response?.status === 404) return null;
      }
      throw err;
    }
  },

  // ── 9. 특정 사용자가 변경한 파일 이력 조회 ──
  async getFileHistoryByUser(userId: string, limit?: number): Promise<FileHistory[]> {
    const qs = limit ? `?limit=${limit}` : '';
    const url = `/v1/admin/audit-logs/file-history/user/${userId}${qs}`;
    const { data } = await apiClient.get<FileHistory[]>(url, { baseURL: AUDIT_BASE });
    log('GET', url, 200, data);
    return data;
  },

  // ── 10. 시간 범위 통합 타임라인 조회 ──
  async getTimeline(params: TimelineQueryParams): Promise<UnifiedTimelineResponse> {
    const qs = buildQuery(params);
    const url = `/v1/admin/timeline?${qs}`;
    const { data } = await apiClient.get<UnifiedTimelineResponse>(url);
    log('GET', url, 200, data);
    return data;
  },

  // ── 11. 파일 중심 타임라인 조회 ──
  async getTimelineByFile(fileId: string, params?: EntityTimelineParams): Promise<UnifiedTimelineResponse> {
    const qs = params ? buildQuery(params) : '';
    const url = `/v1/admin/timeline/files/${fileId}${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<UnifiedTimelineResponse>(url);
    log('GET', url, 200, data);
    return data;
  },

  // ── 12. 사용자 중심 타임라인 조회 ──
  async getTimelineByActor(actorId: string, params?: EntityTimelineParams): Promise<UnifiedTimelineResponse> {
    const qs = params ? buildQuery(params) : '';
    const url = `/v1/admin/timeline/actors/${actorId}${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<UnifiedTimelineResponse>(url);
    log('GET', url, 200, data);
    return data;
  },

  // ── 13. HTTP 요청 추적 ──
  async getTimelineByRequest(requestId: string): Promise<UnifiedTimelineResponse> {
    const url = `/v1/admin/timeline/requests/${requestId}`;
    const { data } = await apiClient.get<UnifiedTimelineResponse>(url);
    log('GET', url, 200, data);
    return data;
  },

  // ── 14. 트레이스 추적 ──
  async getTimelineByTrace(traceId: string): Promise<UnifiedTimelineResponse> {
    const url = `/v1/admin/timeline/traces/${traceId}`;
    const { data } = await apiClient.get<UnifiedTimelineResponse>(url);
    log('GET', url, 200, data);
    return data;
  },

  // ── 15. 이벤트 인과관계 체인 조회 ──
  async getEventChain(eventId: string): Promise<ObservabilityEvent[]> {
    const url = `/v1/admin/timeline/events/${eventId}/chain`;
    const { data } = await apiClient.get<ObservabilityEvent[]>(url);
    log('GET', url, 200, data);
    return data;
  },
};

export default auditLogApi;
