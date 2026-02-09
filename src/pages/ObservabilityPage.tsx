/**
 * ObservabilityPage - NAS 모니터링 대시보드
 * Storage Usage, System Status (24H), System Information 표시
 */
import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useInternalAuth } from '../hooks/useInternalAuth';
import { useObservability } from '../hooks/useObservability';
import type {
  ObservabilityCurrent,
  ObservabilityHistory,
  ObservabilitySettings,
  UpdateObservabilitySettings,
} from '../types/observability';

// ─── 유틸리티 함수 ───

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusDisplay(status: string): { label: string; color: string; dot: string } {
  if (status === 'unhealthy') {
    return { label: 'Offline', color: '#ef4444', dot: 'bg-red-500' };
  }
  if (status === 'degraded') {
    return { label: 'Degraded', color: '#f59e0b', dot: 'bg-amber-500' };
  }
  return { label: 'Online', color: '#22c55e', dot: 'bg-green-500' };
}

function getUsageColor(usagePercent: number, threshold: number): string {
  if (usagePercent >= threshold) return '#ef4444';
  if (usagePercent >= threshold * 0.9) return '#f59e0b';
  return '#3b82f6';
}

// ─── Storage Usage 카드 (도넛 차트) ───

function StorageUsageCard({
  current,
  threshold,
}: {
  current: ObservabilityCurrent;
  threshold: number;
}) {
  const usagePercent = current.usagePercent ?? 0;
  const usedBytes = current.usedBytes ?? 0;
  const totalBytes = current.totalBytes ?? 0;
  const freeBytes = current.freeBytes ?? 0;
  const color = getUsageColor(usagePercent, threshold);

  const donutData = [
    { name: '사용량', value: usedBytes, color },
    { name: '여유 공간', value: freeBytes, color: '#e5e7eb' },
  ];

  // 임계치 위치 각도 계산 (도넛 차트에서 빨간 표시)
  const thresholdAngle = 90 - (threshold / 100) * 360; // recharts startAngle=90 기준

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Storage Usage
        </h3>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-gray-900">
          {usagePercent.toFixed(1)}%
        </span>
        <span className="text-sm text-gray-500">
          {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
        </span>
      </div>

      {/* 도넛 차트 */}
      <div className="flex justify-center">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              {/* 임계치 마커 */}
              <Pie
                data={[{ value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={83}
                startAngle={thresholdAngle + 1}
                endAngle={thresholdAngle - 1}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#ef4444" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: color }}
          />
          사용량
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
          여유 공간
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          임계치 {threshold}%
        </div>
      </div>
    </div>
  );
}

// ─── 이력 조회 기간 옵션 ───

const HISTORY_RANGE_OPTIONS = [
  { value: 1, label: '1H' },
  { value: 6, label: '6H' },
  { value: 12, label: '12H' },
  { value: 24, label: '24H' },
  { value: 48, label: '48H' },
  { value: 168, label: '7D' },
] as const;

// ─── System Status 카드 (타임라인 차트) ───

function SystemStatusCard({
  history,
  selectedHours,
  onHoursChange,
}: {
  history: ObservabilityHistory;
  selectedHours: number;
  onHoursChange: (hours: number) => void;
}) {
  const chartData = history.items.map((item) => ({
    time: new Date(item.checkedAt).getTime(),
    value: item.status !== 'unhealthy' ? 1 : 0,
    label: item.status !== 'unhealthy' ? '정상' : '비정상',
    timeLabel: formatTime(item.checkedAt),
  }));

  const rangeLabel = HISTORY_RANGE_OPTIONS.find((o) => o.value === selectedHours)?.label ?? `${selectedHours}H`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          System Status ({rangeLabel})
        </h3>
        {/* 기간 선택 */}
        <div className="flex items-center gap-0.5">
          {HISTORY_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onHoursChange(opt.value)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                selectedHours === opt.value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-gray-900">
          {history.healthyPercent.toFixed(0)}%
        </span>
        <span className="text-sm text-gray-500">
          ({history.healthyHours.toFixed(0)}h 정상 / {history.unhealthyHours.toFixed(0)}h 비정상)
        </span>
      </div>

      {/* 타임라인 스텝 차트 */}
      <div className="h-36">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) => {
                  const d = new Date(ts);
                  return `${d.getHours()}:00`;
                }}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 1]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(ts) => formatTime(new Date(ts as number).toISOString())}
                formatter={(value: number) => [
                  value === 1 ? '정상' : '비정상',
                  '상태',
                ]}
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="#3b82f6"
                fill="#dbeafe"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            아직 수집된 이력이 없습니다
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-500">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
        시스템 상태 (1=정상, 0=비정상)
      </div>
    </div>
  );
}

// ─── System Information 섹션 ───

function SystemInfoSection({ current }: { current: ObservabilityCurrent }) {
  const statusDisplay = getStatusDisplay(current.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-6">
        System Information
      </h3>

      <div className="grid grid-cols-2 gap-y-6">
        {/* SERVER NAME */}
        <div>
          <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Server Name
          </dt>
          <dd className="text-sm font-medium text-gray-900">
            {current.serverName ?? 'Unknown'}
          </dd>
        </div>

        {/* STATUS */}
        <div>
          <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Status
          </dt>
          <dd className="text-sm font-medium flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusDisplay.dot}`} />
            <span style={{ color: statusDisplay.color }}>{statusDisplay.label}</span>
          </dd>
        </div>

        {/* TOTAL CAPACITY */}
        <div>
          <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Capacity
          </dt>
          <dd className="text-sm font-medium text-gray-900">
            {formatBytes(current.totalBytes)}
          </dd>
        </div>

        {/* USED SPACE */}
        <div>
          <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Used Space
          </dt>
          <dd className="text-sm font-medium text-gray-900">
            {formatBytes(current.usedBytes)}
          </dd>
        </div>

        {/* LAST CHECKED */}
        <div>
          <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Last Checked
          </dt>
          <dd className="text-sm font-medium text-gray-900">
            {formatTime(current.checkedAt)}
          </dd>
        </div>
      </div>
    </div>
  );
}

// ─── 설정 관리 패널 ───

const SETTING_CONFIGS = [
  {
    key: 'intervalMinutes' as const,
    label: '헬스체크 주기',
    unit: '분',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: '스케줄러가 NAS 상태를 체크하는 간격입니다. 짧을수록 실시간에 가깝지만 서버 부하가 증가합니다.',
    min: 1,
    max: 60,
    step: 1,
    presets: [1, 3, 5, 10, 15, 30, 60],
  },
  {
    key: 'retentionDays' as const,
    label: '이력 보존 기간',
    unit: '일',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    description: '이 기간을 초과한 이력 데이터는 매일 자정에 자동 삭제됩니다.',
    min: 1,
    max: 365,
    step: 1,
    presets: [1, 3, 7, 14, 30, 90, 365],
  },
  {
    key: 'thresholdPercent' as const,
    label: '스토리지 임계치',
    unit: '%',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    description: '사용률이 이 임계치를 초과하면 도넛 차트에 경고로 표시됩니다.',
    min: 50,
    max: 99,
    step: 1,
    presets: [50, 60, 70, 80, 85, 90, 95],
  },
] as const;

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: ObservabilitySettings;
  onSave: (data: UpdateObservabilitySettings) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const hasChanges =
    form.intervalMinutes !== settings.intervalMinutes ||
    form.retentionDays !== settings.retentionDays ||
    form.thresholdPercent !== settings.thresholdPercent;

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);

    // 변경된 필드만 전송
    const patch: UpdateObservabilitySettings = {};
    if (form.intervalMinutes !== settings.intervalMinutes) patch.intervalMinutes = form.intervalMinutes;
    if (form.retentionDays !== settings.retentionDays) patch.retentionDays = form.retentionDays;
    if (form.thresholdPercent !== settings.thresholdPercent) patch.thresholdPercent = form.thresholdPercent;

    try {
      await onSave(patch);
      setFeedback({ type: 'success', msg: '설정이 저장되었습니다. 최대 1분 이내에 반영됩니다.' });
      setEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '설정 저장에 실패했습니다';
      setFeedback({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...settings });
    setEditing(false);
    setFeedback(null);
  };

  const validate = (key: typeof SETTING_CONFIGS[number]['key'], value: number) => {
    const cfg = SETTING_CONFIGS.find((c) => c.key === key)!;
    return value >= cfg.min && value <= cfg.max;
  };

  const allValid =
    validate('intervalMinutes', form.intervalMinutes) &&
    validate('retentionDays', form.retentionDays) &&
    validate('thresholdPercent', form.thresholdPercent);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Settings</h3>
            <p className="text-xs text-gray-400">Observability 모니터링 설정 관리</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => { setEditing(true); setFeedback(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              편집
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges || !allValid}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    저장 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 피드백 메시지 */}
      {feedback && (
        <div
          className={`mx-6 mt-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {feedback.msg}
        </div>
      )}

      {/* 설정 항목들 */}
      <div className="p-6 space-y-5">
        {SETTING_CONFIGS.map((cfg) => {
          const currentValue = settings[cfg.key];
          const formValue = form[cfg.key];
          const isValid = validate(cfg.key, formValue);
          const isChanged = formValue !== currentValue;

          return (
            <div
              key={cfg.key}
              className={`rounded-xl border p-5 transition-colors ${
                editing
                  ? isChanged
                    ? 'border-blue-200 bg-blue-50/30'
                    : 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50/30'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* 아이콘 */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    editing && isChanged ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cfg.icon}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">{cfg.label}</h4>
                    {!editing && (
                      <span className="text-lg font-bold text-gray-900">
                        {currentValue}
                        <span className="text-sm font-normal text-gray-400 ml-0.5">{cfg.unit}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{cfg.description}</p>

                  {editing && (
                    <div className="space-y-3">
                      {/* 슬라이더 + 입력 */}
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={cfg.min}
                          max={cfg.max}
                          step={cfg.step}
                          value={formValue}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [cfg.key]: Number(e.target.value) }))
                          }
                          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={cfg.min}
                            max={cfg.max}
                            value={formValue}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, [cfg.key]: Number(e.target.value) }))
                            }
                            className={`w-16 px-2 py-1 text-sm text-center font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              !isValid
                                ? 'border-red-300 bg-red-50 text-red-600'
                                : 'border-gray-300 bg-white text-gray-900'
                            }`}
                          />
                          <span className="text-xs text-gray-400 w-4">{cfg.unit}</span>
                        </div>
                      </div>

                      {/* 프리셋 버튼들 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cfg.presets.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setForm((f) => ({ ...f, [cfg.key]: preset }))}
                            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                              formValue === preset
                                ? 'bg-blue-500 text-white font-medium'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {preset}{cfg.unit}
                          </button>
                        ))}
                      </div>

                      {/* Validation 에러 */}
                      {!isValid && (
                        <p className="text-xs text-red-500">
                          {cfg.min}~{cfg.max} 범위의 값을 입력하세요
                        </p>
                      )}

                      {/* 변경 표시 */}
                      {isChanged && isValid && (
                        <p className="text-xs text-blue-500">
                          {currentValue}{cfg.unit} → {formValue}{cfg.unit}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* API 정보 푸터 */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>GET /v1/admin/observability/settings</span>
          <span>PUT /v1/admin/observability/settings (부분 업데이트)</span>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───

export function ObservabilityPage() {
  const { auth } = useInternalAuth();
  const [historyHours, setHistoryHours] = useState(24);
  const {
    current,
    history,
    settings,
    loading,
    error,
    refetch,
    updateSettings,
  } = useObservability(auth.token ?? null, { historyHours });
  const [showSettings, setShowSettings] = useState(false);

  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">상단 헤더에서 SSO 로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
          <p className="text-red-800 font-medium mb-2">서버 연결에 실패했습니다</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const threshold = settings?.thresholdPercent ?? 80;

  return (
    <div className="h-full overflow-auto bg-gray-50 p-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Observability</h1>
        <p className="text-sm text-blue-500 mt-0.5">
          Monitor system performance, storage usage, and activity metrics
        </p>
      </div>

      {/* degraded 경고 배너 */}
      {current?.status === 'degraded' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          NAS 응답이 느립니다 ({current.responseTimeMs}ms). 네트워크 상태를 확인하세요.
        </div>
      )}

      {/* unhealthy 에러 배너 */}
      {current?.status === 'unhealthy' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          NAS 연결에 실패했습니다: {current.error || 'Unknown error'}
        </div>
      )}

      {/* 상단 카드 2개 */}
      <div className="flex gap-6 mb-6">
        {current && current.status !== 'unhealthy' && (
          <StorageUsageCard current={current} threshold={threshold} />
        )}
        {current?.status === 'unhealthy' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1 flex items-center justify-center text-gray-400">
            NAS 연결 불가 - 스토리지 정보를 표시할 수 없습니다
          </div>
        )}
        {history && (
          <SystemStatusCard
            history={history}
            selectedHours={historyHours}
            onHoursChange={setHistoryHours}
          />
        )}
      </div>

      {/* System Information */}
      {current && <SystemInfoSection current={current} />}

      {/* 설정 패널 (토글) */}
      {showSettings && settings ? (
        <div className="mt-6">
          <SettingsPanel
            settings={settings}
            onSave={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      ) : (
        /* 설정 열기 버튼 */
        <button
          onClick={() => setShowSettings(true)}
          className="fixed bottom-8 right-8 w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
          title="설정"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
