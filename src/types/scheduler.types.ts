/**
 * 스케줄러 모니터링 관련 타입 정의
 * Backend: v1/admin/scheduler
 */

export interface ScheduledJobSummary {
  jobName: string;
  jobDescription: string;
  jobGroup: string;
}

export interface BatchExecutionLog {
  id: number;
  jobName: string;
  jobGroup: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILURE';
  durationMs: number | null;
  errorMessage: string | null;
}

export interface DashboardSummary {
  totalJobs: number;
  runningNow: string[];
  last24h: {
    successCount: number;
    failureCount: number;
    successRate: number;
  };
  recentFailures: {
    jobName: string;
    startedAt: string;
    errorMessage: string | null;
  }[];
}
