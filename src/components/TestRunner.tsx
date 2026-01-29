/**
 * TestRunner Component
 * 시나리오 테스트 자동 실행기
 * 
 * 실행 플로우:
 * SC-001: 로그인 → SC-010: 목록조회 → SC-011: 상세조회 → 
 * SC-012: 뷰어접근 → SC-013: 다운로드 → SC-003: 로그아웃
 */
import type { ScenarioStep } from '../types/api.types';

interface TestRunnerProps {
  onRunScenario: () => Promise<void>;
  steps: ScenarioStep[];
  isRunning: boolean;
}

export function TestRunner({
  onRunScenario,
  steps,
  isRunning,
}: TestRunnerProps) {
  const completedSteps = steps.filter((s) => s.status === 'success').length;
  const errorSteps = steps.filter((s) => s.status === 'error').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  const getStatusIcon = (status: ScenarioStep['status']) => {
    switch (status) {
      case 'success':
        return <span className="text-green-500">✓</span>;
      case 'error':
        return <span className="text-red-500">✗</span>;
      case 'running':
        return <span className="text-blue-500 animate-pulse">●</span>;
      default:
        return <span className="text-gray-300">○</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">시나리오 테스트</h2>
        <button
          onClick={onRunScenario}
          disabled={isRunning}
          className={`
            px-4 py-2 rounded font-medium text-sm
            ${isRunning 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'}
          `}
        >
          {isRunning ? '실행 중...' : '자동 실행'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>진행: {completedSteps}/{steps.length} 단계</span>
          {errorSteps > 0 && (
            <span className="text-red-500">실패: {errorSteps}</span>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              errorSteps > 0 ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`
              p-3 rounded border transition-colors
              ${step.status === 'running' ? 'border-blue-300 bg-blue-50' : ''}
              ${step.status === 'success' ? 'border-green-200 bg-green-50' : ''}
              ${step.status === 'error' ? 'border-red-200 bg-red-50' : ''}
              ${step.status === 'pending' ? 'border-gray-200' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(step.status)}
              <span className="font-mono text-sm text-gray-500">{step.id}</span>
              <span className="font-medium">{step.name}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1 pl-6">
              {step.description}
            </div>
            {step.error && (
              <div className="text-sm text-red-600 mt-2 pl-6 bg-red-50 p-2 rounded">
                {step.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {!isRunning && completedSteps === steps.length && steps.length > 0 && (
        <div className={`mt-4 p-3 rounded text-center font-medium ${
          errorSteps === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {errorSteps === 0 
            ? '모든 시나리오가 성공적으로 완료되었습니다!' 
            : `${errorSteps}개의 시나리오가 실패했습니다.`}
        </div>
      )}
    </div>
  );
}

// 시나리오 정의
export const SCENARIO_STEPS: Omit<ScenarioStep, 'status' | 'result' | 'error'>[] = [
  {
    id: 'SC-001',
    name: '외부 사용자 로그인',
    description: 'POST /v1/ext-auth/login',
  },
  {
    id: 'SC-010',
    name: '공유 목록 조회',
    description: 'GET /v1/ext/shares',
  },
  {
    id: 'SC-011',
    name: '공유 상세 조회',
    description: 'GET /v1/ext/shares/:shareId',
  },
  {
    id: 'SC-012',
    name: '파일 뷰어 접근',
    description: 'GET /v1/ext/shares/:shareId/content',
  },
  {
    id: 'SC-013',
    name: '파일 다운로드',
    description: 'GET /v1/ext/shares/:shareId/download',
  },
  {
    id: 'SC-003',
    name: '로그아웃',
    description: 'POST /v1/ext-auth/logout',
  },
];

// 시나리오 초기화 함수
export const initializeScenarioSteps = (): ScenarioStep[] => {
  return SCENARIO_STEPS.map((step) => ({
    ...step,
    status: 'pending',
  }));
};
