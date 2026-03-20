/**
 * SchedulerMonitorPage - 시스템 스케줄 모니터링
 *
 * Backend API: v1/admin/scheduler
 * - 대시보드 요약 (총 잡 수, 실행중, 24h 성공률, 최근 실패)
 * - 등록된 잡 목록 + 실행 이력 조회
 * - 수동 트리거
 */
import { useState, useCallback, useEffect } from 'react';
import { schedulerApi } from '../api/schedulerApi';
import type {
  ScheduledJobSummary,
  BatchExecutionLog,
  DashboardSummary,
} from '../types/scheduler.types';

// ─── 상수 ───

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  FAILURE: 'bg-red-100 text-red-800',
  RUNNING: 'bg-yellow-100 text-yellow-800',
};

const JOB_GROUP_LABELS: Record<string, string> = {
  'health-check': '헬스체크',
  'file-maintenance': '파일 정리',
  sync: '동기화',
  cache: '캐시',
  share: '공유',
  system: '시스템',
  audit: '감사',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── 컴포넌트 ───

export function SchedulerMonitorPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = useState<ScheduledJobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [history, setHistory] = useState<BatchExecutionLog[]>([]);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [loading, setLoading] = useState({ dashboard: false, jobs: false, history: false });
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── 데이터 로드 ───

  const loadDashboard = useCallback(async () => {
    setLoading((p) => ({ ...p, dashboard: true }));
    try {
      const { data } = await schedulerApi.getDashboard();
      setDashboard(data);
    } catch (e: unknown) {
      setError(`대시보드 로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading((p) => ({ ...p, dashboard: false }));
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading((p) => ({ ...p, jobs: true }));
    try {
      const { data } = await schedulerApi.getJobs();
      setJobs(data);
    } catch (e: unknown) {
      setError(`잡 목록 로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading((p) => ({ ...p, jobs: false }));
    }
  }, []);

  const loadHistory = useCallback(async (jobName: string, limit: number) => {
    setLoading((p) => ({ ...p, history: true }));
    try {
      const { data } = await schedulerApi.getJobHistory(jobName, limit);
      setHistory(data);
    } catch (e: unknown) {
      setError(`이력 로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading((p) => ({ ...p, history: false }));
    }
  }, []);

  // ─── 잡 트리거 ───

  const handleTrigger = useCallback(async (jobName: string) => {
    if (!confirm(`"${jobName}" 잡을 수동 실행하시겠습니까?`)) return;
    setTriggerLoading(jobName);
    try {
      const { data } = await schedulerApi.triggerJob(jobName);
      alert(data.message);
      // 대시보드 & 이력 새로고침
      loadDashboard();
      if (selectedJob === jobName) loadHistory(jobName, historyLimit);
    } catch (e: unknown) {
      alert(`트리거 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggerLoading(null);
    }
  }, [loadDashboard, loadHistory, selectedJob, historyLimit]);

  // ─── 일시정지 / 재개 ───

  const handleTogglePause = useCallback(async (job: ScheduledJobSummary) => {
    const action = job.isPaused ? '재개' : '일시정지';
    if (!confirm(`"${job.jobName}" 잡을 ${action}하시겠습니까?`)) return;
    setPauseLoading(job.jobName);
    try {
      const api = job.isPaused ? schedulerApi.resumeJob : schedulerApi.pauseJob;
      const { data } = await api(job.jobName);
      alert(data.message);
      loadDashboard();
      loadJobs();
    } catch (e: unknown) {
      alert(`${action} 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPauseLoading(null);
    }
  }, [loadDashboard, loadJobs]);

  // ─── 잡 선택 ───

  const handleSelectJob = useCallback((jobName: string) => {
    setSelectedJob(jobName);
    setHistoryLimit(20);
    loadHistory(jobName, 20);
  }, [loadHistory]);

  // ─── 초기 로드 ───

  useEffect(() => {
    loadDashboard();
    loadJobs();
  }, [loadDashboard, loadJobs]);

  // ─── 자동 새로고침 (30초) ───

  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">시스템 스케줄</h1>
        <button
          onClick={() => { loadDashboard(); loadJobs(); }}
          className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* 대시보드 요약 카드 */}
      {loading.dashboard && !dashboard ? (
        <div className="text-center text-gray-500 py-8">대시보드 로딩 중...</div>
      ) : dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 총 잡 수 */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">등록된 잡</div>
            <div className="text-3xl font-bold text-gray-900">{dashboard.totalJobs}</div>
          </div>

          {/* 실행 중 */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">현재 실행 중</div>
            <div className="text-3xl font-bold text-yellow-600">{dashboard.runningNow.length}</div>
            {dashboard.runningNow.length > 0 && (
              <div className="mt-2 space-y-1">
                {dashboard.runningNow.map((name) => (
                  <span key={name} className="inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mr-1">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 일시정지 중 */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">일시정지</div>
            <div className="text-3xl font-bold text-orange-600">{dashboard.pausedJobs.length}</div>
            {dashboard.pausedJobs.length > 0 && (
              <div className="mt-2 space-y-1">
                {dashboard.pausedJobs.map((name) => (
                  <span key={name} className="inline-block text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded mr-1">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 24h 성공률 */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">24시간 성공률</div>
            <div className={`text-3xl font-bold ${dashboard.last24h.successRate >= 90 ? 'text-green-600' : dashboard.last24h.successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
              {dashboard.last24h.successRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              성공 {dashboard.last24h.successCount} / 실패 {dashboard.last24h.failureCount}
            </div>
          </div>

          {/* 최근 실패 */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">최근 실패</div>
            <div className="text-3xl font-bold text-red-600">{dashboard.recentFailures.length}</div>
            {dashboard.recentFailures.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                {dashboard.recentFailures.map((f, i) => (
                  <div key={i} className="text-xs text-red-700">
                    <span className="font-medium">{f.jobName}</span>
                    <span className="text-red-400 ml-1">{formatTime(f.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 잡 목록 & 이력 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 잡 목록 */}
        <div className="lg:col-span-1 bg-white border rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50 rounded-t-lg">
            <h2 className="font-semibold text-gray-800">등록된 잡 목록</h2>
          </div>
          {loading.jobs ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">등록된 잡이 없습니다</div>
          ) : (
            <ul className="divide-y max-h-[600px] overflow-y-auto">
              {jobs.map((job) => (
                <li
                  key={job.jobName}
                  className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedJob === job.jobName ? 'bg-blue-50 border-l-2 border-blue-500' : ''} ${job.isPaused ? 'opacity-60' : ''}`}
                  onClick={() => handleSelectJob(job.jobName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-gray-900 truncate">{job.jobName}</span>
                        {job.isPaused && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                            정지
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{job.jobDescription}</div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {JOB_GROUP_LABELS[job.jobGroup] || job.jobGroup}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePause(job); }}
                        disabled={pauseLoading === job.jobName}
                        className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${job.isPaused ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                      >
                        {pauseLoading === job.jobName ? '...' : job.isPaused ? '재개' : '정지'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTrigger(job.jobName); }}
                        disabled={triggerLoading === job.jobName || job.isPaused}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {triggerLoading === job.jobName ? '...' : '실행'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 실행 이력 */}
        <div className="lg:col-span-2 bg-white border rounded-lg shadow-sm">
          <div className="p-4 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {selectedJob ? `${selectedJob} 실행 이력` : '실행 이력'}
            </h2>
            {selectedJob && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">조회 수:</label>
                <select
                  value={historyLimit}
                  onChange={(e) => {
                    const limit = Number(e.target.value);
                    setHistoryLimit(limit);
                    loadHistory(selectedJob, limit);
                  }}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            )}
          </div>

          {!selectedJob ? (
            <div className="p-12 text-center text-gray-400">
              좌측 잡 목록에서 잡을 선택하면 실행 이력이 표시됩니다
            </div>
          ) : loading.history ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">실행 이력이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">ID</th>
                    <th className="px-4 py-2 text-left font-medium">상태</th>
                    <th className="px-4 py-2 text-left font-medium">시작 시간</th>
                    <th className="px-4 py-2 text-left font-medium">종료 시간</th>
                    <th className="px-4 py-2 text-left font-medium">소요 시간</th>
                    <th className="px-4 py-2 text-left font-medium">그룹</th>
                    <th className="px-4 py-2 text-left font-medium">에러</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600">{log.id}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[log.status] || 'bg-gray-100 text-gray-800'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{formatTime(log.startedAt)}</td>
                      <td className="px-4 py-2 text-gray-700">{formatTime(log.finishedAt)}</td>
                      <td className="px-4 py-2 text-gray-700">{formatDuration(log.durationMs)}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {JOB_GROUP_LABELS[log.jobGroup] || log.jobGroup}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-red-600 text-xs max-w-xs truncate" title={log.errorMessage || undefined}>
                        {log.errorMessage || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
