/**
 * 스케줄러 모니터링 API
 * Backend: v1/admin/scheduler
 */
import apiClient from './apiClient';
import type {
  ScheduledJobSummary,
  BatchExecutionLog,
  DashboardSummary,
} from '../types/scheduler.types';

export const schedulerApi = {
  /** 대시보드 요약 조회 */
  getDashboard: () =>
    apiClient.get<DashboardSummary>('/admin/scheduler/dashboard'),

  /** 등록된 전체 잡 목록 조회 */
  getJobs: () =>
    apiClient.get<ScheduledJobSummary[]>('/admin/scheduler/jobs'),

  /** 특정 잡 실행 이력 조회 */
  getJobHistory: (jobName: string, limit = 20) =>
    apiClient.get<BatchExecutionLog[]>(
      `/admin/scheduler/jobs/${encodeURIComponent(jobName)}/history`,
      { params: { limit } },
    ),

  /** 잡 수동 트리거 */
  triggerJob: (jobName: string) =>
    apiClient.post<{ message: string }>(
      `/admin/scheduler/jobs/${encodeURIComponent(jobName)}/trigger`,
    ),
};
