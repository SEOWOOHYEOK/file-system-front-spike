/**
 * AuditLogPage - 관리자 감사 로그 및 통합 타임라인
 *
 * 15개 API 엔드포인트 전체 연동:
 * - 감사 로그 목록/상세/사용자별/대상별/세션별
 * - 파일 이력 목록/파일별/버전별/사용자별
 * - 통합 타임라인/파일 중심/사용자 중심/요청 추적/트레이스/이벤트 체인
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useInternalAuth } from "../hooks/useInternalAuth";
import { auditLogApi } from "../api/auditLogApi";
import type {
  AuditLog,
  AuditLogSummary,
  FileHistory,
  ObservabilityEvent,
  AuditLogQueryParams,
  FileHistoryQueryParams,
  TimelineQueryParams,
  UnifiedTimelineResponse,
  ActionCategory,
  EventTypeCategory,
  ResultFilter,
} from "../types/audit-log.types";

// ─── 상수 ───

const EVENT_TYPE_LABELS: Record<EventTypeCategory, string> = {
  all: "전체",
  user_activity: "사용자 행위",
  permission: "권한 변경",
  file_operation: "파일 조작",
  share_request: "공유/요청 처리",
  security: "보안 이벤트",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  file_operation: "bg-blue-100 text-blue-800",
  permission: "bg-purple-100 text-purple-800",
  share_request: "bg-green-100 text-green-800",
  user_activity: "bg-orange-100 text-orange-800",
  security: "bg-red-100 text-red-800",
  file: "bg-blue-100 text-blue-800",
  folder: "bg-indigo-100 text-indigo-800",
  share: "bg-green-100 text-green-800",
  auth: "bg-orange-100 text-orange-800",
  admin: "bg-yellow-100 text-yellow-800",
  user: "bg-teal-100 text-teal-800",
  external: "bg-pink-100 text-pink-800",
};

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  FAIL: "bg-red-100 text-red-800",
  FAILURE: "bg-red-100 text-red-800",
};

const CATEGORY_MAP: Record<ActionCategory, EventTypeCategory> = {
  file: "file_operation",
  folder: "file_operation",
  share: "share_request",
  auth: "user_activity",
  admin: "permission",
  user: "user_activity",
  security: "security",
  external: "share_request",
};

const ACTION_LABELS: Record<string, string> = {
  FILE_VIEW: "파일 조회",
  FILE_DOWNLOAD: "파일 다운로드",
  FILE_UPLOAD: "파일 업로드",
  FILE_RENAME: "파일 이름 변경",
  FILE_MOVE: "파일 이동",
  FILE_DELETE: "파일 삭제",
  FILE_RESTORE: "파일 복원",
  FILE_PURGE: "파일 영구 삭제",
  FOLDER_CREATE: "폴더 생성",
  FOLDER_VIEW: "폴더 조회",
  FOLDER_RENAME: "폴더 이름 변경",
  FOLDER_MOVE: "폴더 이동",
  FOLDER_DELETE: "폴더 삭제",
  SHARE_CREATE: "공유 생성",
  SHARE_REVOKE: "공유 해제",
  SHARE_ACCESS: "공유 접근",
  SHARE_DOWNLOAD: "공유 다운로드",
  SHARE_BLOCK: "공유 차단",
  SHARE_UNBLOCK: "공유 차단 해제",
  SHARE_BULK_BLOCK: "공유 일괄 차단",
  SHARE_BULK_UNBLOCK: "공유 일괄 차단 해제",
  SHARE_REQUEST_CREATE: "공유 요청",
  SHARE_REQUEST_APPROVE: "공유 요청 승인",
  SHARE_REQUEST_REJECT: "공유 요청 거부",
  SHARE_REQUEST_CANCEL: "공유 요청 취소",
  SHARE_REQUEST_BULK_APPROVE: "공유 일괄 승인",
  SHARE_REQUEST_BULK_REJECT: "공유 일괄 거부",
  PERMISSION_GRANT: "권한 부여",
  PERMISSION_REVOKE: "권한 회수",
  PERMISSION_CHANGE: "권한 변경",
  TRASH_EMPTY: "휴지통 비우기",
  TRASH_VIEW: "휴지통 조회",
  FAVORITE_ADD: "즐겨찾기 등록",
  FAVORITE_REMOVE: "즐겨찾기 해제",
  FAVORITE_VIEW: "즐겨찾기 조회",
  ACTIVITY_VIEW: "최근 활동 조회",
  EXTERNAL_USER_CREATE: "외부 사용자 생성",
  EXTERNAL_USER_UPDATE: "외부 사용자 수정",
  EXTERNAL_USER_DEACTIVATE: "외부 사용자 비활성화",
  EXTERNAL_USER_ACTIVATE: "외부 사용자 활성화",
  EXTERNAL_USER_PASSWORD_RESET: "외부 사용자 비밀번호 초기화",
  PASSWORD_CHANGE: "비밀번호 변경",
  USER_ROLE_ASSIGN: "역할 부여",
  USER_ROLE_REMOVE: "역할 제거",
  USER_SYNC: "사용자 동기화",
  TOKEN_GENERATE: "토큰 생성",
  TOKEN_REFRESH: "토큰 갱신",
  ORG_MIGRATION: "조직 마이그레이션",
  FILE_ACTION_REQUEST_MOVE_CREATE: "파일 이동 요청",
  FILE_ACTION_REQUEST_DELETE_CREATE: "파일 삭제 요청",
  FILE_ACTION_REQUEST_CANCEL: "파일 요청 취소",
  FILE_ACTION_REQUEST_APPROVE: "파일 요청 승인",
  FILE_ACTION_REQUEST_REJECT: "파일 요청 반려",
  FILE_ACTION_REQUEST_BULK_APPROVE: "파일 요청 일괄 승인",
  FILE_ACTION_REQUEST_BULK_REJECT: "파일 요청 일괄 반려",
  FILE_ACTION_REQUEST_INVALIDATED: "파일 요청 무효화",
  EXTERNAL_SHARE_DETAIL: "외부 공유 상세",
  EXTERNAL_SHARE_ACCESS: "외부 공유 접근",
  EXTERNAL_SHARE_DOWNLOAD: "외부 공유 다운로드",
  LOGIN_SUCCESS: "로그인",
  LOGIN_FAILURE: "로그인 실패",
  LOGOUT: "로그아웃",
  TOKEN_EXPIRED: "토큰 만료",
  PERMISSION_DENIED: "권한 거부",
  EXPIRED_LINK_ACCESS: "만료 링크 접근",
  BLOCKED_SHARE_ACCESS: "차단 공유 접근",
  ACCESS_PATTERN_DEVIATION: "접근 패턴 이탈",
  NEW_DEVICE_ACCESS: "신규 기기 접근",
};

const FILE_CHANGE_LABELS: Record<string, string> = {
  CREATED: "생성",
  CONTENT_REPLACED: "내용 교체",
  RENAMED: "이름 변경",
  MOVED: "이동",
  METADATA_CHANGED: "메타데이터 변경",
  TRASHED: "휴지통 이동",
  RESTORED: "복원",
  DELETED: "영구 삭제",
};

const PERIOD_OPTIONS = [
  { value: "1h", label: "1시간" },
  { value: "6h", label: "6시간" },
  { value: "1d", label: "1일" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "custom", label: "사용자 지정" },
];

type ViewTab = "summary" | "audit" | "file-history" | "timeline";

// ─── 유틸리티 ───

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${m}.${day}. ${h}:${min}:${s}`;
}

function getTimeRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let fromDate: Date;
  switch (period) {
    case "1h":
      fromDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "6h":
      fromDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case "1d":
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
  }
  return { from: fromDate.toISOString(), to };
}

function getCategoryLabel(category: ActionCategory): string {
  const labels: Record<ActionCategory, string> = {
    file: "파일 조작",
    folder: "파일 조작",
    share: "공유/요청 처리",
    auth: "사용자 행위",
    admin: "권한 변경",
    user: "사용자 행위",
    security: "보안 이벤트",
    external: "공유/요청 처리",
  };
  return labels[category] || category;
}

// ─── 서브 컴포넌트: 필터 사이드바 ───

function FilterPanel({
  logs,
  eventFilter,
  setEventFilter,
  resultFilter,
  setResultFilter,
}: {
  logs: AuditLog[];
  eventFilter: EventTypeCategory;
  setEventFilter: (v: EventTypeCategory) => void;
  resultFilter: ResultFilter;
  setResultFilter: (v: ResultFilter) => void;
}) {
  const counts = useMemo(() => {
    const byType: Record<EventTypeCategory, number> = {
      all: logs.length,
      user_activity: 0,
      permission: 0,
      file_operation: 0,
      share_request: 0,
      security: 0,
    };
    const byResult: Record<ResultFilter, number> = {
      all: logs.length,
      SUCCESS: 0,
      FAIL: 0,
    };
    for (const log of logs) {
      const cat = CATEGORY_MAP[log.actionCategory];
      if (cat) byType[cat]++;
      byResult[log.result]++;
    }
    return { byType, byResult };
  }, [logs]);

  return (
    <div className='w-44 shrink-0 border-r border-gray-200 bg-white overflow-y-auto'>
      {/* 이벤트 타입 */}
      <div className='p-3 border-b border-gray-100'>
        <h3 className='text-xs font-semibold text-gray-500 mb-2'>
          이벤트 타입
        </h3>
        <ul className='space-y-0.5'>
          {(Object.keys(EVENT_TYPE_LABELS) as EventTypeCategory[]).map(
            (key) => (
              <li key={key}>
                <button
                  onClick={() => setEventFilter(key)}
                  className={`w-full flex items-center justify-between px-2 py-1 text-xs rounded transition-colors ${
                    eventFilter === key
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{EVENT_TYPE_LABELS[key]}</span>
                  <span
                    className={`text-xs ${eventFilter === key ? "text-blue-600" : "text-gray-400"}`}
                  >
                    {counts.byType[key]}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      </div>

      {/* 결과 상태 */}
      <div className='p-3'>
        <h3 className='text-xs font-semibold text-gray-500 mb-2'>결과 상태</h3>
        <ul className='space-y-0.5'>
          {(["all", "SUCCESS", "FAIL"] as ResultFilter[]).map((key) => (
            <li key={key}>
              <button
                onClick={() => setResultFilter(key)}
                className={`w-full flex items-center justify-between px-2 py-1 text-xs rounded transition-colors ${
                  resultFilter === key
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span>
                  {key === "all" ? "전체" : key === "SUCCESS" ? "성공" : "실패"}
                </span>
                <span
                  className={`text-xs ${resultFilter === key ? "text-blue-600" : "text-gray-400"}`}
                >
                  {counts.byResult[key]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 타임라인 차트 ───

function TimelineChart({ logs }: { logs: AuditLog[] }) {
  const chartData = useMemo(() => {
    if (logs.length === 0) return [];
    const buckets = new Map<
      string,
      { time: string; count: number; success: number; fail: number }
    >();
    for (const log of logs) {
      const d = new Date(log.createdAt);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (!buckets.has(key)) {
        buckets.set(key, { time: key, count: 0, success: 0, fail: 0 });
      }
      const b = buckets.get(key)!;
      b.count++;
      if (log.result === "SUCCESS") b.success++;
      else b.fail++;
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }, [logs]);

  if (chartData.length === 0) return null;

  return (
    <div className='h-20 bg-white border-b border-gray-200 px-4 py-2'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={chartData} barSize={6}>
          <CartesianGrid
            strokeDasharray='3 3'
            vertical={false}
            stroke='#f0f0f0'
          />
          <XAxis
            dataKey='time'
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px" }}
            formatter={(value, name) => [
              String(value),
              name === "success" ? "성공" : "실패",
            ]}
          />
          <Bar
            dataKey='success'
            fill='#10b981'
            stackId='a'
            radius={[1, 1, 0, 0]}
          />
          <Bar
            dataKey='fail'
            fill='#ef4444'
            stackId='a'
            radius={[1, 1, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 서브 컴포넌트: 감사 로그 테이블 ───

function AuditLogTable({
  logs,
  loading,
  onSelect,
  selectedId,
}: {
  logs: AuditLog[];
  loading: boolean;
  onSelect: (log: AuditLog) => void;
  selectedId?: string;
}) {
  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        로딩 중...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        감사 로그가 없습니다.
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-auto'>
      <table className='w-full text-xs'>
        <thead className='bg-gray-50 sticky top-0 z-10'>
          <tr className='text-left text-gray-500 border-b border-gray-200'>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>시간</th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>
              이벤트명
            </th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>
              이벤트 타입
            </th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>결과</th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>사용자</th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>파일명</th>
            <th className='px-3 py-2 font-medium whitespace-nowrap'>API</th>
            <th className='px-3 py-2 font-medium'>설명</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              onClick={() => onSelect(log)}
              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                selectedId === log.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <td className='px-3 py-2 whitespace-nowrap text-gray-600'>
                {formatDate(log.createdAt)}
              </td>
              <td className='px-3 py-2 whitespace-nowrap font-medium text-gray-800'>
                {ACTION_LABELS[log.action] || log.action}
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    EVENT_TYPE_COLORS[log.actionCategory] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getCategoryLabel(log.actionCategory)}
                </span>
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    RESULT_COLORS[log.result] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {log.result === "SUCCESS" ? "성공" : "실패"}
                </span>
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-700'>
                {log.userName || "-"}
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-700 max-w-[160px] truncate'>
                {log.targetName || "-"}
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-500'>
                {log.httpMethod && log.apiEndpoint ? (
                  <span>
                    <span className='font-mono'>{log.httpMethod}</span>{" "}
                    <span className='font-mono'>{log.apiEndpoint}</span>{" "}
                    {log.responseStatusCode && (
                      <span
                        className={`font-mono ${
                          log.responseStatusCode < 400
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {log.responseStatusCode}
                      </span>
                    )}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className='px-3 py-2 text-gray-600 max-w-[240px] truncate'>
                {log.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 서브 컴포넌트: 파일 이력 테이블 ───

function FileHistoryTable({
  items,
  loading,
  onSelect,
  selectedId,
}: {
  items: FileHistory[];
  loading: boolean;
  onSelect: (item: FileHistory) => void;
  selectedId?: string;
}) {
  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        로딩 중...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        파일 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-auto'>
      <table className='w-full text-xs'>
        <thead className='bg-gray-50 sticky top-0 z-10'>
          <tr className='text-left text-gray-500 border-b border-gray-200'>
            <th className='px-3 py-2 font-medium'>시간</th>
            <th className='px-3 py-2 font-medium'>파일 ID</th>
            <th className='px-3 py-2 font-medium'>버전</th>
            <th className='px-3 py-2 font-medium'>변경 유형</th>
            <th className='px-3 py-2 font-medium'>변경자</th>
            <th className='px-3 py-2 font-medium'>요약</th>
            <th className='px-3 py-2 font-medium'>설명</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                selectedId === item.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <td className='px-3 py-2 whitespace-nowrap text-gray-600'>
                {formatDate(item.createdAt)}
              </td>
              <td className='px-3 py-2 whitespace-nowrap font-mono text-gray-500 max-w-[100px] truncate'>
                {item.fileId}
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-700'>
                v{item.version}
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                <span className='inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800'>
                  {FILE_CHANGE_LABELS[item.changeType] || item.changeType}
                </span>
              </td>
              <td className='px-3 py-2 whitespace-nowrap font-mono text-gray-500 max-w-[100px] truncate'>
                {item.changedBy}
              </td>
              <td className='px-3 py-2 text-gray-600 max-w-[160px] truncate'>
                {item.changeSummary || "-"}
              </td>
              <td className='px-3 py-2 text-gray-600 max-w-[240px] truncate'>
                {item.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 서브 컴포넌트: 통합 타임라인 테이블 ───

function TimelineTable({
  events,
  loading,
  onSelect,
  selectedId,
}: {
  events: ObservabilityEvent[];
  loading: boolean;
  onSelect: (event: ObservabilityEvent) => void;
  selectedId?: string;
}) {
  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        로딩 중...
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        타임라인 이벤트가 없습니다.
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-auto'>
      <table className='w-full text-xs'>
        <thead className='bg-gray-50 sticky top-0 z-10'>
          <tr className='text-left text-gray-500 border-b border-gray-200'>
            <th className='px-3 py-2 font-medium'>시간</th>
            <th className='px-3 py-2 font-medium'>소스</th>
            <th className='px-3 py-2 font-medium'>이벤트</th>
            <th className='px-3 py-2 font-medium'>결과</th>
            <th className='px-3 py-2 font-medium'>행위자</th>
            <th className='px-3 py-2 font-medium'>대상</th>
            <th className='px-3 py-2 font-medium'>API</th>
            <th className='px-3 py-2 font-medium'>설명</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              onClick={() => onSelect(event)}
              className={`border-b border-gray-100 cursor-pointer transition-colors ${
                selectedId === event.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <td className='px-3 py-2 whitespace-nowrap text-gray-600'>
                {formatDate(event.occurredAt)}
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    event.eventSource === "AUDIT"
                      ? "bg-blue-100 text-blue-800"
                      : event.eventSource === "FILE_CHANGE"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {event.eventSource}
                </span>
              </td>
              <td className='px-3 py-2 whitespace-nowrap font-medium text-gray-800'>
                {ACTION_LABELS[event.eventType] ||
                  FILE_CHANGE_LABELS[event.eventType] ||
                  event.eventType}
              </td>
              <td className='px-3 py-2 whitespace-nowrap'>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    RESULT_COLORS[event.result] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {event.result === "SUCCESS" ? "성공" : "실패"}
                </span>
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-700'>
                {event.actorName || event.actorId}
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-700 max-w-[140px] truncate'>
                {event.targetName || "-"}
              </td>
              <td className='px-3 py-2 whitespace-nowrap text-gray-500 font-mono'>
                {event.httpMethod && event.apiEndpoint
                  ? `${event.httpMethod} ${event.apiEndpoint}`
                  : "-"}
                {event.responseStatusCode ? ` ${event.responseStatusCode}` : ""}
              </td>
              <td className='px-3 py-2 text-gray-600 max-w-[240px] truncate'>
                {event.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 서브 컴포넌트: 상세 패널 ───

function DetailPanel({
  auditLog,
  fileHistory,
  timelineEvent,
  eventChain,
  onClose,
  onViewUserLogs,
  onViewTargetLogs,
  onViewSessionLogs,
  onViewEventChain,
  onViewRequestTimeline,
  onViewTraceTimeline,
}: {
  auditLog?: AuditLog | null;
  fileHistory?: FileHistory | null;
  timelineEvent?: ObservabilityEvent | null;
  eventChain?: ObservabilityEvent[];
  onClose: () => void;
  onViewUserLogs?: (userId: string) => void;
  onViewTargetLogs?: (targetType: string, targetId: string) => void;
  onViewSessionLogs?: (sessionId: string) => void;
  onViewEventChain?: (eventId: string) => void;
  onViewRequestTimeline?: (requestId: string) => void;
  onViewTraceTimeline?: (traceId: string) => void;
}) {
  if (!auditLog && !fileHistory && !timelineEvent) return null;

  return (
    <div className='w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto'>
      <div className='flex items-center justify-between p-3 border-b border-gray-200'>
        <h3 className='text-sm font-semibold text-gray-800'>상세 정보</h3>
        <button
          onClick={onClose}
          className='text-gray-400 hover:text-gray-600 text-lg leading-none'
        >
          &times;
        </button>
      </div>

      {/* 감사 로그 상세 */}
      {auditLog && (
        <div className='p-3 space-y-3 text-xs'>
          <Section title='기본 정보'>
            <Field label='ID' value={auditLog.id} mono />
            <Field
              label='이벤트'
              value={ACTION_LABELS[auditLog.action] || auditLog.action}
            />
            <Field
              label='카테고리'
              value={getCategoryLabel(auditLog.actionCategory)}
              badge={EVENT_TYPE_COLORS[auditLog.actionCategory]}
            />
            <Field
              label='결과'
              value={auditLog.result === "SUCCESS" ? "성공" : "실패"}
              badge={RESULT_COLORS[auditLog.result]}
            />
            {auditLog.failReason && (
              <Field label='실패 사유' value={auditLog.failReason} />
            )}
            <Field label='시간' value={formatDate(auditLog.createdAt)} />
            {auditLog.durationMs != null && (
              <Field label='소요 시간' value={`${auditLog.durationMs}ms`} />
            )}
          </Section>

          <Section title='사용자'>
            <Field label='이름' value={auditLog.userName || "-"} />
            <Field label='이메일' value={auditLog.userEmail || "-"} />
            <Field label='유형' value={auditLog.userType} />
            <Field label='ID' value={auditLog.userId} mono />
            {onViewUserLogs && (
              <button
                onClick={() => onViewUserLogs(auditLog.userId)}
                className='text-blue-600 hover:underline text-[10px] mt-1'
              >
                이 사용자의 모든 로그 보기
              </button>
            )}
          </Section>

          <Section title='대상'>
            <Field label='타입' value={auditLog.targetType} />
            <Field label='ID' value={auditLog.targetId} mono />
            <Field label='이름' value={auditLog.targetName || "-"} />
            <Field label='경로' value={auditLog.targetPath || "-"} />
            {auditLog.sensitivity && (
              <Field label='기밀 등급' value={auditLog.sensitivity} />
            )}
            {onViewTargetLogs && (
              <button
                onClick={() =>
                  onViewTargetLogs(auditLog.targetType, auditLog.targetId)
                }
                className='text-blue-600 hover:underline text-[10px] mt-1'
              >
                이 대상의 접근 이력 보기
              </button>
            )}
          </Section>

          <Section title='클라이언트'>
            <Field label='IP' value={auditLog.ipAddress} />
            <Field label='클라이언트' value={auditLog.clientType} />
            <Field
              label='User-Agent'
              value={auditLog.userAgent}
              className='break-all'
            />
          </Section>

          <Section title='API 컨텍스트'>
            {auditLog.httpMethod && (
              <Field label='메서드' value={auditLog.httpMethod} />
            )}
            {auditLog.apiEndpoint && (
              <Field label='엔드포인트' value={auditLog.apiEndpoint} mono />
            )}
            {auditLog.responseStatusCode && (
              <Field
                label='응답 코드'
                value={String(auditLog.responseStatusCode)}
              />
            )}
          </Section>

          <Section title='추적'>
            <Field label='요청 ID' value={auditLog.requestId} mono />
            {auditLog.sessionId && (
              <>
                <Field label='세션 ID' value={auditLog.sessionId} mono />
                {onViewSessionLogs && (
                  <button
                    onClick={() => onViewSessionLogs(auditLog.sessionId!)}
                    className='text-blue-600 hover:underline text-[10px] mt-1'
                  >
                    이 세션의 활동 로그 보기
                  </button>
                )}
              </>
            )}
            {auditLog.traceId && (
              <>
                <Field label='트레이스 ID' value={auditLog.traceId} mono />
                {onViewTraceTimeline && (
                  <button
                    onClick={() => onViewTraceTimeline(auditLog.traceId!)}
                    className='text-blue-600 hover:underline text-[10px] mt-1'
                  >
                    트레이스 추적
                  </button>
                )}
              </>
            )}
            {auditLog.parentEventId && (
              <>
                <Field
                  label='부모 이벤트'
                  value={auditLog.parentEventId}
                  mono
                />
                {onViewEventChain && (
                  <button
                    onClick={() => onViewEventChain(auditLog.id)}
                    className='text-blue-600 hover:underline text-[10px] mt-1'
                  >
                    인과관계 체인 보기
                  </button>
                )}
              </>
            )}
            {onViewRequestTimeline && (
              <button
                onClick={() => onViewRequestTimeline(auditLog.requestId)}
                className='text-blue-600 hover:underline text-[10px] mt-1'
              >
                요청 추적 보기
              </button>
            )}
          </Section>

          {auditLog.severity && (
            <Section title='보안'>
              <Field
                label='심각도'
                value={auditLog.severity}
                badge={
                  auditLog.severity === "CRITICAL"
                    ? "bg-red-100 text-red-800"
                    : auditLog.severity === "HIGH"
                      ? "bg-orange-100 text-orange-800"
                      : auditLog.severity === "WARN"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-600"
                }
              />
              {auditLog.errorCode && (
                <Field label='에러 코드' value={auditLog.errorCode} />
              )}
            </Section>
          )}

          {auditLog.metadata && Object.keys(auditLog.metadata).length > 0 && (
            <Section title='메타데이터'>
              <pre className='bg-gray-50 rounded p-2 text-[10px] text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap'>
                {JSON.stringify(auditLog.metadata, null, 2)}
              </pre>
            </Section>
          )}

          <Section title='설명'>
            <p className='text-gray-700'>{auditLog.description}</p>
          </Section>
        </div>
      )}

      {/* 파일 이력 상세 */}
      {fileHistory && (
        <div className='p-3 space-y-3 text-xs'>
          <Section title='기본 정보'>
            <Field label='ID' value={fileHistory.id} mono />
            <Field label='파일 ID' value={fileHistory.fileId} mono />
            <Field label='버전' value={`v${fileHistory.version}`} />
            <Field
              label='변경 유형'
              value={
                FILE_CHANGE_LABELS[fileHistory.changeType] ||
                fileHistory.changeType
              }
            />
            <Field label='변경자' value={fileHistory.changedBy} mono />
            <Field label='시간' value={formatDate(fileHistory.createdAt)} />
          </Section>

          {fileHistory.previousState && (
            <Section title='이전 상태'>
              <pre className='bg-gray-50 rounded p-2 text-[10px] text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap'>
                {JSON.stringify(fileHistory.previousState, null, 2)}
              </pre>
            </Section>
          )}

          {fileHistory.newState && (
            <Section title='새 상태'>
              <pre className='bg-gray-50 rounded p-2 text-[10px] text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap'>
                {JSON.stringify(fileHistory.newState, null, 2)}
              </pre>
            </Section>
          )}

          {(fileHistory.checksumBefore || fileHistory.checksumAfter) && (
            <Section title='체크섬'>
              {fileHistory.checksumBefore && (
                <Field label='이전' value={fileHistory.checksumBefore} mono />
              )}
              {fileHistory.checksumAfter && (
                <Field label='이후' value={fileHistory.checksumAfter} mono />
              )}
            </Section>
          )}

          <Section title='설명'>
            <p className='text-gray-700'>{fileHistory.description}</p>
            {fileHistory.changeSummary && (
              <p className='text-gray-500 mt-1'>{fileHistory.changeSummary}</p>
            )}
          </Section>
        </div>
      )}

      {/* 타임라인 이벤트 상세 */}
      {timelineEvent && (
        <div className='p-3 space-y-3 text-xs'>
          <Section title='기본 정보'>
            <Field label='ID' value={timelineEvent.id} mono />
            <Field label='소스' value={timelineEvent.eventSource} />
            <Field
              label='이벤트'
              value={
                ACTION_LABELS[timelineEvent.eventType] ||
                timelineEvent.eventType
              }
            />
            <Field
              label='결과'
              value={timelineEvent.result === "SUCCESS" ? "성공" : "실패"}
              badge={RESULT_COLORS[timelineEvent.result]}
            />
            <Field label='시간' value={formatDate(timelineEvent.occurredAt)} />
            {timelineEvent.durationMs != null && (
              <Field
                label='소요 시간'
                value={`${timelineEvent.durationMs}ms`}
              />
            )}
            {timelineEvent.severity && (
              <Field label='심각도' value={timelineEvent.severity} />
            )}
          </Section>

          <Section title='행위자/대상'>
            <Field
              label='행위자'
              value={timelineEvent.actorName || timelineEvent.actorId}
            />
            <Field
              label='대상'
              value={timelineEvent.targetName || timelineEvent.targetId || "-"}
            />
          </Section>

          {(timelineEvent.httpMethod || timelineEvent.apiEndpoint) && (
            <Section title='API'>
              {timelineEvent.httpMethod && (
                <Field label='메서드' value={timelineEvent.httpMethod} />
              )}
              {timelineEvent.apiEndpoint && (
                <Field
                  label='엔드포인트'
                  value={timelineEvent.apiEndpoint}
                  mono
                />
              )}
              {timelineEvent.responseStatusCode && (
                <Field
                  label='응답 코드'
                  value={String(timelineEvent.responseStatusCode)}
                />
              )}
            </Section>
          )}

          {timelineEvent.parentEventId && (
            <Section title='추적'>
              {timelineEvent.requestId && (
                <Field label='요청 ID' value={timelineEvent.requestId} mono />
              )}
              {timelineEvent.traceId && (
                <Field label='트레이스 ID' value={timelineEvent.traceId} mono />
              )}
              <Field
                label='부모 이벤트'
                value={timelineEvent.parentEventId}
                mono
              />
              {onViewEventChain && (
                <button
                  onClick={() => onViewEventChain(timelineEvent.id)}
                  className='text-blue-600 hover:underline text-[10px] mt-1'
                >
                  인과관계 체인 보기
                </button>
              )}
            </Section>
          )}

          <Section title='설명'>
            <p className='text-gray-700'>{timelineEvent.description}</p>
          </Section>

          {/* 이벤트 체인 */}
          {eventChain && eventChain.length > 0 && (
            <Section title='인과관계 체인'>
              <div className='space-y-2'>
                {eventChain.map((ev, idx) => (
                  <div
                    key={ev.id}
                    className='relative pl-4 border-l-2 border-blue-200'
                  >
                    <div className='absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-400' />
                    <p className='font-medium text-gray-700'>
                      {idx + 1}. {ACTION_LABELS[ev.eventType] || ev.eventType}
                    </p>
                    <p className='text-gray-500'>{ev.description}</p>
                    <p className='text-gray-400'>{formatDate(ev.occurredAt)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 상세 패널 헬퍼 ───

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className='text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1'>
        {title}
      </h4>
      <div className='space-y-1'>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  badge,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 ${className || ""}`}>
      <span className='text-gray-400 w-16 shrink-0'>{label}</span>
      {badge ? (
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badge}`}
        >
          {value}
        </span>
      ) : (
        <span
          className={`text-gray-700 break-all ${mono ? "font-mono text-[10px]" : ""}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: 페이지네이션 ───

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className='flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-white text-xs text-gray-500'>
      <span>
        총 {total}건 / {totalPages} 페이지
      </span>
      <div className='flex items-center gap-1'>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className='px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50'
        >
          이전
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4));
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2 py-1 rounded border ${
                p === page
                  ? "bg-blue-500 text-white border-blue-500"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className='px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-50'
        >
          다음
        </button>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 통합 타임라인 Summary ───

function TimelineSummary({
  summary,
}: {
  summary: UnifiedTimelineResponse["summary"];
}) {
  return (
    <div className='flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs'>
      <span className='text-gray-500'>
        총 <strong className='text-gray-800'>{summary.total}</strong>건
      </span>
      <span className='text-gray-300'>|</span>
      {Object.entries(summary.bySource).map(([source, count]) => (
        <span key={source} className='text-gray-500'>
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1 ${
              source === "AUDIT"
                ? "bg-blue-400"
                : source === "FILE_CHANGE"
                  ? "bg-indigo-400"
                  : "bg-gray-400"
            }`}
          />
          {source}: <strong>{count}</strong>
        </span>
      ))}
      <span className='text-gray-300'>|</span>
      <span className='text-green-600'>
        성공: <strong>{summary.byResult.SUCCESS}</strong>
      </span>
      <span className='text-red-600'>
        실패: <strong>{summary.byResult.FAILURE}</strong>
      </span>
    </div>
  );
}

// ─── 서브 컴포넌트: 감사 로그 요약 대시보드 ───

const SUMMARY_CATEGORY_COLORS: Record<string, string> = {
  file: "#3b82f6",
  folder: "#6366f1",
  share: "#10b981",
  security: "#ef4444",
  admin: "#f59e0b",
  user: "#14b8a6",
  auth: "#f97316",
  external: "#ec4899",
};

const SUMMARY_CATEGORY_BG: Record<string, string> = {
  file: "bg-blue-50 border-blue-200",
  folder: "bg-indigo-50 border-indigo-200",
  share: "bg-emerald-50 border-emerald-200",
  security: "bg-red-50 border-red-200",
  admin: "bg-amber-50 border-amber-200",
  user: "bg-teal-50 border-teal-200",
  auth: "bg-orange-50 border-orange-200",
  external: "bg-pink-50 border-pink-200",
};

const SUMMARY_CATEGORY_TEXT: Record<string, string> = {
  file: "text-blue-700",
  folder: "text-indigo-700",
  share: "text-emerald-700",
  security: "text-red-700",
  admin: "text-amber-700",
  user: "text-teal-700",
  auth: "text-orange-700",
  external: "text-pink-700",
};

const RESULT_PIE_COLORS = {
  SUCCESS: "#10b981",
  FAIL: "#ef4444",
};

function SummaryDashboard({
  summary,
  loading,
  error,
  onRetry,
}: {
  summary: AuditLogSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        요약 데이터를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center gap-3'>
        <p className='text-sm text-red-500'>{error}</p>
        <button
          onClick={onRetry}
          className='px-4 py-2 text-xs bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100'
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-400 text-sm'>
        요약 데이터가 없습니다.
      </div>
    );
  }

  const successCount =
    summary.byResult.find((r) => r.result === "SUCCESS")?.count ?? 0;
  const failCount =
    summary.byResult.find((r) => r.result === "FAIL")?.count ?? 0;
  const successRate =
    summary.total > 0
      ? ((successCount / summary.total) * 100).toFixed(1)
      : "0.0";

  const pieData = summary.byResult.map((r) => ({
    name: r.label,
    value: r.count,
    result: r.result,
  }));

  const barData = [...summary.byEventType].sort((a, b) => b.count - a.count);

  return (
    <div className='flex-1 overflow-y-auto p-6 space-y-6'>
      {/* 상단 요약 카드 */}
      <div className='grid grid-cols-4 gap-4'>
        {/* 전체 로그 */}
        <div className='bg-white border border-gray-200 rounded-xl p-5 shadow-sm'>
          <p className='text-xs font-medium text-gray-500 mb-1'>전체 로그</p>
          <p className='text-3xl font-bold text-gray-900'>
            {summary.total.toLocaleString()}
          </p>
          <p className='text-xs text-gray-400 mt-1'>
            조회 기간 내 총 감사 로그 수
          </p>
        </div>

        {/* 성공 */}
        <div className='bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm'>
          <p className='text-xs font-medium text-emerald-600 mb-1'>성공</p>
          <p className='text-3xl font-bold text-emerald-700'>
            {successCount.toLocaleString()}
          </p>
          <p className='text-xs text-emerald-500 mt-1'>성공률 {successRate}%</p>
        </div>

        {/* 실패 */}
        <div className='bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm'>
          <p className='text-xs font-medium text-red-600 mb-1'>실패</p>
          <p className='text-3xl font-bold text-red-700'>
            {failCount.toLocaleString()}
          </p>
          <p className='text-xs text-red-500 mt-1'>
            전체 대비{" "}
            {summary.total > 0
              ? ((failCount / summary.total) * 100).toFixed(1)
              : "0.0"}
            %
          </p>
        </div>

        {/* 카테고리 수 */}
        <div className='bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm'>
          <p className='text-xs font-medium text-blue-600 mb-1'>
            이벤트 카테고리
          </p>
          <p className='text-3xl font-bold text-blue-700'>
            {summary.byEventType.length}
          </p>
          <p className='text-xs text-blue-500 mt-1'>활성 카테고리 수</p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className='grid grid-cols-3 gap-6'>
        {/* 이벤트 타입별 막대 차트 */}
        <div className='col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm'>
          <h3 className='text-sm font-semibold text-gray-800 mb-4'>
            카테고리별 로그 분포
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <BarChart
                data={barData}
                layout='vertical'
                margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray='3 3'
                  horizontal
                  stroke='#f0f0f0'
                />
                <XAxis
                  type='number'
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type='category'
                  dataKey='label'
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [
                    value.toLocaleString() + "건",
                    "로그 수",
                  ]}
                />
                <Bar dataKey='count' radius={[0, 4, 4, 0]} barSize={24}>
                  {barData.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={
                        SUMMARY_CATEGORY_COLORS[entry.category] || "#94a3b8"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='h-[280px] flex items-center justify-center text-gray-400 text-sm'>
              데이터가 없습니다.
            </div>
          )}
        </div>

        {/* 결과별 파이 차트 */}
        <div className='bg-white border border-gray-200 rounded-xl p-5 shadow-sm'>
          <h3 className='text-sm font-semibold text-gray-800 mb-4'>
            결과 상태 비율
          </h3>
          {pieData.length > 0 && summary.total > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='45%'
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey='value'
                  stroke='none'
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.result}
                      fill={
                        RESULT_PIE_COLORS[
                          entry.result as keyof typeof RESULT_PIE_COLORS
                        ] || "#94a3b8"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [
                    value.toLocaleString() + "건",
                    "",
                  ]}
                />
                <Legend
                  verticalAlign='bottom'
                  iconType='circle'
                  iconSize={8}
                  formatter={(value) => (
                    <span className='text-xs text-gray-600'>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className='h-[280px] flex items-center justify-center text-gray-400 text-sm'>
              데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 카테고리별 상세 카드 */}
      <div className='bg-white border border-gray-200 rounded-xl p-5 shadow-sm'>
        <h3 className='text-sm font-semibold text-gray-800 mb-4'>
          카테고리별 상세
        </h3>
        <div className='grid grid-cols-4 gap-3'>
          {barData.map((item) => {
            const pct =
              summary.total > 0
                ? ((item.count / summary.total) * 100).toFixed(1)
                : "0.0";
            return (
              <div
                key={item.category}
                className={`rounded-lg border p-4 ${SUMMARY_CATEGORY_BG[item.category] || "bg-gray-50 border-gray-200"}`}
              >
                <div className='flex items-center justify-between mb-2'>
                  <span
                    className={`text-xs font-semibold ${SUMMARY_CATEGORY_TEXT[item.category] || "text-gray-700"}`}
                  >
                    {item.label}
                  </span>
                  <span className='text-[10px] text-gray-400'>{pct}%</span>
                </div>
                <p
                  className={`text-xl font-bold ${SUMMARY_CATEGORY_TEXT[item.category] || "text-gray-700"}`}
                >
                  {item.count.toLocaleString()}
                </p>
                {/* 프로그레스 바 */}
                <div className='mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all duration-500'
                    style={{
                      width: `${Math.min(100, summary.total > 0 ? (item.count / summary.total) * 100 : 0)}%`,
                      backgroundColor:
                        SUMMARY_CATEGORY_COLORS[item.category] || "#94a3b8",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───

export function AuditLogPage() {
  const { auth } = useInternalAuth();

  // ── 상태: 뷰 탭 ──
  const [viewTab, setViewTab] = useState<ViewTab>("summary");
  const [period, setPeriod] = useState("1d");
  const [searchQuery, setSearchQuery] = useState("");

  // ── 상태: 필터 ──
  const [eventFilter, setEventFilter] = useState<EventTypeCategory>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  // ── 상태: 데이터 ──
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  const [fileHistories, setFileHistories] = useState<FileHistory[]>([]);
  const [fileHistoryTotal, setFileHistoryTotal] = useState(0);
  const [fileHistoryTotalPages, setFileHistoryTotalPages] = useState(0);
  const [fileHistoryPage, setFileHistoryPage] = useState(1);

  const [timelineResponse, setTimelineResponse] =
    useState<UnifiedTimelineResponse | null>(null);
  const [timelinePage, setTimelinePage] = useState(1);

  // ── 상태: 요약 ──
  const [summaryData, setSummaryData] = useState<AuditLogSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── 상태: 로딩 / 에러 ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 상태: 상세 패널 ──
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(
    null,
  );
  const [selectedFileHistory, setSelectedFileHistory] =
    useState<FileHistory | null>(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] =
    useState<ObservabilityEvent | null>(null);
  const [eventChain, setEventChain] = useState<ObservabilityEvent[]>([]);

  // ── 상태: 토스트 ──
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // ── 감사 로그 조회 ──
  const fetchAuditLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = getTimeRange(period);
        const params: AuditLogQueryParams = {
          page,
          limit: 50,
          startDate: from,
          endDate: to,
        };
        const result = await auditLogApi.getAuditLogs(params);
        setAuditLogs(result.data);
        setAuditTotal(result.total);
        setAuditTotalPages(result.totalPages);
        setAuditPage(result.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "감사 로그 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  // ── 파일 이력 조회 ──
  const fetchFileHistories = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = getTimeRange(period);
        const params: FileHistoryQueryParams = {
          page,
          limit: 50,
          startDate: from,
          endDate: to,
        };
        const result = await auditLogApi.getFileHistories(params);
        setFileHistories(result.data);
        setFileHistoryTotal(result.total);
        setFileHistoryTotalPages(result.totalPages);
        setFileHistoryPage(result.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "파일 이력 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  // ── 통합 타임라인 조회 ──
  const fetchTimeline = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = getTimeRange(period);
        const params: TimelineQueryParams = {
          from,
          to,
          page,
          size: 50,
        };
        const result = await auditLogApi.getTimeline(params);
        setTimelineResponse(result);
        setTimelinePage(result.page.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "타임라인 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  // ── 감사 로그 요약 조회 ──
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { from, to } = getTimeRange(period);
      const result = await auditLogApi.getAuditLogSummary({
        startDate: from,
        endDate: to,
      });
      setSummaryData(result);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "감사 로그 요약 조회 실패",
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [period]);

  // ── 초기 로드 ──
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    if (viewTab === "summary") fetchSummary();
    else if (viewTab === "audit") fetchAuditLogs(1);
    else if (viewTab === "file-history") fetchFileHistories(1);
    else if (viewTab === "timeline") fetchTimeline(1);
  }, [
    auth.isAuthenticated,
    viewTab,
    period,
    fetchSummary,
    fetchAuditLogs,
    fetchFileHistories,
    fetchTimeline,
  ]);

  // ── 필터된 감사 로그 ──
  const filteredAuditLogs = useMemo(() => {
    let filtered = auditLogs;

    // 이벤트 타입 필터
    if (eventFilter !== "all") {
      filtered = filtered.filter(
        (log) => CATEGORY_MAP[log.actionCategory] === eventFilter,
      );
    }

    // 결과 필터
    if (resultFilter !== "all") {
      filtered = filtered.filter((log) => log.result === resultFilter);
    }

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.userName?.toLowerCase().includes(q) ||
          log.targetName?.toLowerCase().includes(q) ||
          log.description?.toLowerCase().includes(q) ||
          ACTION_LABELS[log.action]?.toLowerCase().includes(q) ||
          log.apiEndpoint?.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [auditLogs, eventFilter, resultFilter, searchQuery]);

  // ── 상세 패널 동작 ──
  const closeDetail = useCallback(() => {
    setSelectedAuditLog(null);
    setSelectedFileHistory(null);
    setSelectedTimelineEvent(null);
    setEventChain([]);
  }, []);

  const handleSelectAuditLog = useCallback(
    async (log: AuditLog) => {
      closeDetail();
      try {
        const detail = await auditLogApi.getAuditLog(log.id);
        setSelectedAuditLog(detail || log);
      } catch {
        setSelectedAuditLog(log);
      }
    },
    [closeDetail],
  );

  const handleSelectFileHistory = useCallback(
    (item: FileHistory) => {
      closeDetail();
      setSelectedFileHistory(item);
    },
    [closeDetail],
  );

  const handleSelectTimelineEvent = useCallback(
    (event: ObservabilityEvent) => {
      closeDetail();
      setSelectedTimelineEvent(event);
    },
    [closeDetail],
  );

  const handleViewEventChain = useCallback(
    async (eventId: string) => {
      try {
        const chain = await auditLogApi.getEventChain(eventId);
        setEventChain(chain);
        showToast(`인과관계 체인 ${chain.length}건 로드`);
      } catch {
        showToast("인과관계 체인 조회 실패", "error");
      }
    },
    [showToast],
  );

  const handleViewUserLogs = useCallback(
    async (userId: string) => {
      setLoading(true);
      try {
        const logs = await auditLogApi.getAuditLogsByUser(userId, 100);
        setAuditLogs(logs);
        setAuditTotal(logs.length);
        setAuditTotalPages(1);
        setAuditPage(1);
        setViewTab("audit");
        showToast(`사용자 로그 ${logs.length}건 로드`);
      } catch {
        showToast("사용자 로그 조회 실패", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleViewTargetLogs = useCallback(
    async (targetType: string, targetId: string) => {
      setLoading(true);
      try {
        const logs = await auditLogApi.getAuditLogsByTarget(
          targetType as any,
          targetId,
          100,
        );
        setAuditLogs(logs);
        setAuditTotal(logs.length);
        setAuditTotalPages(1);
        setAuditPage(1);
        setViewTab("audit");
        showToast(`대상 접근 이력 ${logs.length}건 로드`);
      } catch {
        showToast("대상 접근 이력 조회 실패", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleViewSessionLogs = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      try {
        const logs = await auditLogApi.getAuditLogsBySession(sessionId);
        setAuditLogs(logs);
        setAuditTotal(logs.length);
        setAuditTotalPages(1);
        setAuditPage(1);
        setViewTab("audit");
        showToast(`세션 활동 로그 ${logs.length}건 로드`);
      } catch {
        showToast("세션 활동 로그 조회 실패", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleViewRequestTimeline = useCallback(
    async (requestId: string) => {
      setLoading(true);
      try {
        const result = await auditLogApi.getTimelineByRequest(requestId);
        setTimelineResponse(result);
        setTimelinePage(1);
        setViewTab("timeline");
        showToast(`요청 추적 이벤트 ${result.events.length}건 로드`);
      } catch {
        showToast("요청 추적 조회 실패", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleViewTraceTimeline = useCallback(
    async (traceId: string) => {
      setLoading(true);
      try {
        const result = await auditLogApi.getTimelineByTrace(traceId);
        setTimelineResponse(result);
        setTimelinePage(1);
        setViewTab("timeline");
        showToast(`트레이스 추적 이벤트 ${result.events.length}건 로드`);
      } catch {
        showToast("트레이스 추적 조회 실패", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  // ── 새로고침 ──
  const handleRefresh = useCallback(() => {
    closeDetail();
    if (viewTab === "summary") fetchSummary();
    else if (viewTab === "audit") fetchAuditLogs(auditPage);
    else if (viewTab === "file-history") fetchFileHistories(fileHistoryPage);
    else if (viewTab === "timeline") fetchTimeline(timelinePage);
  }, [
    viewTab,
    auditPage,
    fileHistoryPage,
    timelinePage,
    fetchSummary,
    fetchAuditLogs,
    fetchFileHistories,
    fetchTimeline,
    closeDetail,
  ]);

  // ── 내보내기 (CSV) ──
  const handleExport = useCallback(() => {
    let csv = "";
    if (viewTab === "audit") {
      csv = "시간,이벤트,카테고리,결과,사용자,파일명,API,설명\n";
      for (const log of filteredAuditLogs) {
        csv += `"${formatDate(log.createdAt)}","${ACTION_LABELS[log.action] || log.action}","${getCategoryLabel(log.actionCategory)}","${log.result}","${log.userName || ""}","${log.targetName || ""}","${log.httpMethod || ""} ${log.apiEndpoint || ""} ${log.responseStatusCode || ""}","${log.description}"\n`;
      }
    } else if (viewTab === "file-history") {
      csv = "시간,파일ID,버전,변경유형,변경자,설명\n";
      for (const item of fileHistories) {
        csv += `"${formatDate(item.createdAt)}","${item.fileId}","${item.version}","${item.changeType}","${item.changedBy}","${item.description}"\n`;
      }
    } else if (viewTab === "timeline" && timelineResponse) {
      csv = "시간,소스,이벤트,결과,행위자,대상,설명\n";
      for (const ev of timelineResponse.events) {
        csv += `"${formatDate(ev.occurredAt)}","${ev.eventSource}","${ev.eventType}","${ev.result}","${ev.actorName || ev.actorId}","${ev.targetName || ""}","${ev.description}"\n`;
      }
    }

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${viewTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV 내보내기 완료");
  }, [viewTab, filteredAuditLogs, fileHistories, timelineResponse, showToast]);

  // ── 인증 체크 ──
  if (!auth.isAuthenticated) {
    return (
      <div className='h-full flex items-center justify-center bg-gray-50'>
        <p className='text-gray-500'>로그인이 필요합니다.</p>
      </div>
    );
  }

  const hasDetail =
    selectedAuditLog || selectedFileHistory || selectedTimelineEvent;

  return (
    <div className='h-full flex flex-col bg-gray-50'>
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 헤더 */}
      <div className='bg-white border-b border-gray-200 px-4 py-3'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-lg font-bold text-gray-800'>감사 로그</h1>
            <p className='text-xs text-gray-500 mt-0.5'>
              관리자 감사 로그 및 통합 타임라인 조회
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className='px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
          >
            새로고침
          </button>
        </div>

        {/* 뷰 탭 */}
        <div className='flex items-center gap-1 mt-3'>
          {[
            { key: "summary" as ViewTab, label: "요약" },
            { key: "audit" as ViewTab, label: "감사 로그" },
            { key: "file-history" as ViewTab, label: "파일 이력" },
            { key: "timeline" as ViewTab, label: "통합 타임라인" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setViewTab(tab.key);
                closeDetail();
              }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewTab === tab.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className='mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between'>
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className='ml-4 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 rounded'
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 툴바 */}
      <div className='flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200'>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className='text-xs border border-gray-300 rounded px-2 py-1.5 bg-white'
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className='flex-1 relative'>
          <input
            type='text'
            placeholder='로그 검색...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full text-xs border border-gray-300 rounded px-3 py-1.5 pl-7'
          />
          <span className='absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs'>
            Q
          </span>
        </div>

        <button
          onClick={handleExport}
          className='flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50'
        >
          내보내기
        </button>
      </div>

      {/* 메인 콘텐츠 */}
      <div className='flex-1 flex overflow-hidden'>
        {/* 요약 대시보드 */}
        {viewTab === "summary" && (
          <SummaryDashboard
            summary={summaryData}
            loading={summaryLoading}
            error={summaryError}
            onRetry={fetchSummary}
          />
        )}

        {/* 필터 사이드바 (감사 로그 탭에서만) */}
        {viewTab === "audit" && (
          <FilterPanel
            logs={auditLogs}
            eventFilter={eventFilter}
            setEventFilter={setEventFilter}
            resultFilter={resultFilter}
            setResultFilter={setResultFilter}
          />
        )}

        {/* 메인 영역 */}
        <div className='flex-1 flex flex-col overflow-hidden'>
          {/* 타임라인 차트 (감사 로그 탭에서만) */}
          {viewTab === "audit" && <TimelineChart logs={filteredAuditLogs} />}

          {/* 통합 타임라인 요약 */}
          {viewTab === "timeline" && timelineResponse && (
            <TimelineSummary summary={timelineResponse.summary} />
          )}

          {/* 테이블 영역 */}
          {viewTab === "audit" && (
            <AuditLogTable
              logs={filteredAuditLogs}
              loading={loading}
              onSelect={handleSelectAuditLog}
              selectedId={selectedAuditLog?.id}
            />
          )}
          {viewTab === "file-history" && (
            <FileHistoryTable
              items={fileHistories}
              loading={loading}
              onSelect={handleSelectFileHistory}
              selectedId={selectedFileHistory?.id}
            />
          )}
          {viewTab === "timeline" && (
            <TimelineTable
              events={timelineResponse?.events || []}
              loading={loading}
              onSelect={handleSelectTimelineEvent}
              selectedId={selectedTimelineEvent?.id}
            />
          )}

          {/* 페이지네이션 */}
          {viewTab === "audit" && (
            <Pagination
              page={auditPage}
              totalPages={auditTotalPages}
              total={auditTotal}
              onPageChange={(p) => fetchAuditLogs(p)}
            />
          )}
          {viewTab === "file-history" && (
            <Pagination
              page={fileHistoryPage}
              totalPages={fileHistoryTotalPages}
              total={fileHistoryTotal}
              onPageChange={(p) => fetchFileHistories(p)}
            />
          )}
          {viewTab === "timeline" && timelineResponse && (
            <Pagination
              page={timelinePage}
              totalPages={timelineResponse.page.totalPages}
              total={timelineResponse.page.totalElements}
              onPageChange={(p) => fetchTimeline(p)}
            />
          )}
        </div>

        {/* 상세 패널 (오른쪽) */}
        {hasDetail && (
          <DetailPanel
            auditLog={selectedAuditLog}
            fileHistory={selectedFileHistory}
            timelineEvent={selectedTimelineEvent}
            eventChain={eventChain}
            onClose={closeDetail}
            onViewUserLogs={handleViewUserLogs}
            onViewTargetLogs={handleViewTargetLogs}
            onViewSessionLogs={handleViewSessionLogs}
            onViewEventChain={handleViewEventChain}
            onViewRequestTimeline={handleViewRequestTimeline}
            onViewTraceTimeline={handleViewTraceTimeline}
          />
        )}
      </div>
    </div>
  );
}

export default AuditLogPage;
