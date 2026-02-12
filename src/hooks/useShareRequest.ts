/**
 * useShareRequest - 파일 공유 요청 폼 로직 훅
 *
 * ShareRequestModal의 비즈니스 로직을 분리하여 관리합니다.
 * - 권한 확인 (FILE_SHARE_DIRECT)
 * - 대상자/승인자 검색 (debounced, 서버 사이드)
 * - 스텝 네비게이션
 * - 폼 상태 관리
 * - 가용성 확인 및 요청 제출
 * - 폴더 API 기반 파일 유효성 검증
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { fileShareRequestApi, permissionApi } from '../api/fileShareApi';
import type {
  ShareTargetType,
  ShareTargetUserType,
  SharePermissionType,
  ShareTargetUser,
  ApproverResponse,
  CheckAvailabilityResponse,
  ShareableFile,
  FileWarning,
} from '../types/file-share.types';

// ─── 타입 정의 ───

export type ShareStep = 'target' | 'approver' | 'settings' | 'confirm';

export interface TargetEntry {
  id: string;
  type: ShareTargetType;
  userId: string;
  name?: string;
  email?: string;
}

export interface ShareResult {
  success: boolean;
  message: string;
}

interface UseShareRequestConfig {
  isOpen: boolean;
  files: ShareableFile[];
  onClose: () => void;
}

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

// ─── 유틸리티 ───

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/** 폴더 API 데이터 기반 파일 유효성 검증 */
function validateFiles(files: ShareableFile[]): FileWarning[] {
  const warnings: FileWarning[] = [];

  for (const file of files) {
    // pendingActionRequest 확인
    if (file.pendingActionRequest) {
      const actionLabel = file.pendingActionRequest.type === 'MOVE' ? '이동' : '삭제';
      warnings.push({
        fileId: file.id,
        fileName: file.name,
        type: file.pendingActionRequest.type === 'MOVE' ? 'pending_move' : 'pending_delete',
        message: `${actionLabel} 요청이 대기 중입니다.`,
      });
    }

    // storageStatus 확인
    if (file.storageStatus) {
      const nasStatus = file.storageStatus.nas;
      if (nasStatus && nasStatus !== 'AVAILABLE') {
        if (nasStatus === 'SYNCING' || nasStatus === 'MOVING') {
          warnings.push({
            fileId: file.id,
            fileName: file.name,
            type: 'storage_syncing',
            message: `스토리지 동기화 중입니다. (${nasStatus})`,
          });
        } else if (nasStatus === 'ERROR' || nasStatus === 'UNAVAILABLE') {
          warnings.push({
            fileId: file.id,
            fileName: file.name,
            type: 'storage_unavailable',
            message: `스토리지가 사용 불가 상태입니다. (${nasStatus})`,
          });
        }
      }
    }
  }

  return warnings;
}

// ─── 메인 훅 ───

export function useShareRequest({ isOpen, files, onClose }: UseShareRequestConfig) {
  // ── 권한 상태 ──
  const [hasDirectShare, setHasDirectShare] = useState<boolean | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);

  // ── 스텝 ──
  const [step, setStep] = useState<ShareStep>('target');

  // ── 대상자 ──
  const [targets, setTargets] = useState<TargetEntry[]>([]);
  const [targetType, setTargetType] = useState<ShareTargetType>('EXTERNAL_USER');
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<ShareTargetUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearchUser = useDebounce(searchUser, DEBOUNCE_MS);

  // ── 승인자 ──
  const [designatedApproverId, setDesignatedApproverId] = useState('');
  const [designatedApprover, setDesignatedApprover] = useState<ApproverResponse | null>(null);
  const [approverSearchKeyword, setApproverSearchKeyword] = useState('');
  const [approverResults, setApproverResults] = useState<ApproverResponse[]>([]);
  const [approverSearchLoading, setApproverSearchLoading] = useState(false);
  const debouncedApproverKeyword = useDebounce(approverSearchKeyword, DEBOUNCE_MS);

  // ── 설정 ──
  const [permissionType, setPermissionType] = useState<SharePermissionType>('VIEW');
  const [maxDownloads, setMaxDownloads] = useState(5);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');

  // ── 가용성 & 제출 ──
  const [availability, setAvailability] = useState<CheckAvailabilityResponse | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);

  // ── 파일 유효성 검증 (폴더 API 데이터 기반) ──
  const fileWarnings = useMemo(() => validateFiles(files), [files]);
  const hasBlockingWarnings = useMemo(
    () => fileWarnings.some(w => w.type === 'storage_unavailable' || w.type === 'pending_delete'),
    [fileWarnings],
  );

  // 공유 가능한 파일만 필터 (storage_unavailable, pending_delete 제외)
  const shareableFiles = useMemo(() => {
    const blockedIds = new Set(
      fileWarnings
        .filter(w => w.type === 'storage_unavailable' || w.type === 'pending_delete')
        .map(w => w.fileId),
    );
    return files.filter(f => !blockedIds.has(f.id));
  }, [files, fileWarnings]);

  // ── 권한 확인 (모달 열릴 때) ──
  useEffect(() => {
    if (!isOpen) return;
    setPermissionLoading(true);
    setHasDirectShare(null);
    permissionApi
      .getMyPermissions()
      .then(resp => {
        setHasDirectShare(resp.permissions.includes('FILE_SHARE_DIRECT'));
      })
      .catch(() => setHasDirectShare(false))
      .finally(() => setPermissionLoading(false));
  }, [isOpen]);

  // ── 초기화 (모달 열릴 때) ──
  useEffect(() => {
    if (!isOpen) return;
    setStep('target');
    setTargets([]);
    setDesignatedApproverId('');
    setDesignatedApprover(null);
    setPermissionType('VIEW');
    setMaxDownloads(5);
    setReason('');
    setAvailability(null);
    setResult(null);
    setSearchUser('');
    setSearchResults([]);
    setApproverSearchKeyword('');
    setApproverResults([]);

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setStartAt(today.toISOString().slice(0, 16));
    setEndAt(nextMonth.toISOString().slice(0, 16));
  }, [isOpen]);

  // ── 사용자 검색 (debounced) ──
  const searchApiType: ShareTargetUserType =
    targetType === 'INTERNAL_USER' ? 'INTERNAL' : 'EXTERNAL';

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const doSearch = async () => {
      setSearchLoading(true);
      try {
        const resp = await fileShareRequestApi.searchUsers({
          type: searchApiType,
          name: debouncedSearchUser.trim() || undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) setSearchResults(resp.items);
      } catch (err) {
        console.error('Failed to search users:', err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    };
    doSearch();

    return () => { cancelled = true; };
  }, [isOpen, debouncedSearchUser, searchApiType]);

  // ── 승인자 검색 (debounced) ──
  useEffect(() => {
    if (!isOpen || hasDirectShare) return;
    let cancelled = false;

    const doSearch = async () => {
      setApproverSearchLoading(true);
      try {
        const resp = await fileShareRequestApi.searchApprovers({
          keyword: debouncedApproverKeyword.trim() || undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) setApproverResults(resp.items);
      } catch (err) {
        console.error('Failed to search approvers:', err);
        if (!cancelled) setApproverResults([]);
      } finally {
        if (!cancelled) setApproverSearchLoading(false);
      }
    };
    doSearch();

    return () => { cancelled = true; };
  }, [isOpen, hasDirectShare, debouncedApproverKeyword]);

  // ── 대상자 관리 ──
  const toShareTargetType = (t: ShareTargetUserType): ShareTargetType =>
    t === 'INTERNAL' ? 'INTERNAL_USER' : 'EXTERNAL_USER';

  const addTarget = useCallback(
    (user: ShareTargetUser) => {
      if (targets.some(t => t.userId === user.id)) {
        alert('이미 추가된 대상자입니다.');
        return;
      }
      setTargets(prev => [
        ...prev,
        {
          id: `${Date.now()}`,
          type: toShareTargetType(user.type),
          userId: user.id,
          name: user.name,
          email: user.email,
        },
      ]);
    },
    [targets],
  );

  const removeTarget = useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── 가용성 확인 ──
  const checkAvailability = useCallback(async () => {
    if (shareableFiles.length === 0 || targets.length === 0) return;
    setCheckingAvailability(true);
    try {
      const resp = await fileShareRequestApi.checkAvailability({
        fileIds: shareableFiles.map(f => f.id),
        targets: targets.map(t => ({ type: t.type, userId: t.userId })),
      });
      setAvailability(resp);
    } catch (error) {
      console.error('Failed to check availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  }, [shareableFiles, targets]);

  // ── 스텝 네비게이션 ──
  const steps: ShareStep[] = useMemo(
    () =>
      hasDirectShare === false
        ? ['target', 'approver', 'settings', 'confirm']
        : ['target', 'settings', 'confirm'],
    [hasDirectShare],
  );

  const goNext = useCallback(async () => {
    if (step === 'target') {
      if (targets.length === 0) {
        alert('공유 대상을 최소 1명 이상 추가해주세요.');
        return;
      }
      if (hasDirectShare === false) {
        setStep('approver');
      } else {
        await checkAvailability();
        setStep('settings');
      }
      return;
    }

    if (step === 'approver') {
      if (!designatedApproverId) {
        alert('승인자를 선택해주세요.');
        return;
      }
      await checkAvailability();
      setStep('settings');
      return;
    }

    if (step === 'settings') {
      if (!startAt || !endAt) {
        alert('공유 기간을 설정해주세요.');
        return;
      }
      if (!reason.trim()) {
        alert('공유 사유를 입력해주세요.');
        return;
      }
      setStep('confirm');
      return;
    }

    if (step === 'confirm') {
      await handleSubmit();
    }
  }, [step, targets, hasDirectShare, designatedApproverId, startAt, endAt, reason, checkAvailability]);

  const goPrev = useCallback(() => {
    if (step === 'target') {
      onClose();
      return;
    }
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }, [step, steps, onClose]);

  // ── 제출 ──
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const resp = await fileShareRequestApi.create({
        fileIds: shareableFiles.map(f => f.id),
        targets: targets.map(t => ({ type: t.type, userId: t.userId })),
        permission: {
          type: permissionType,
          ...(permissionType === 'DOWNLOAD' ? { maxDownloads } : {}),
        },
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason.trim(),
        ...(hasDirectShare === false && designatedApproverId
          ? { designatedApproverId }
          : {}),
      });

      setResult({
        success: true,
        message: resp.isAutoApproved
          ? '공유 요청이 자동 승인되었습니다.'
          : '공유 요청이 제출되었습니다. 관리자 승인을 기다려주세요.',
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '공유 요청에 실패했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [shareableFiles, targets, permissionType, maxDownloads, startAt, endAt, reason, hasDirectShare, designatedApproverId]);

  // ── 파생 상태 ──
  const isNextDisabled = useMemo(() => {
    if (submitting || checkingAvailability) return true;
    if (step === 'target') return targets.length === 0;
    if (step === 'approver') return !designatedApproverId;
    if (step === 'settings') return !startAt || !endAt || !reason.trim();
    return false;
  }, [submitting, checkingAvailability, step, targets.length, designatedApproverId, startAt, endAt, reason]);

  const nextButtonLabel = useMemo(() => {
    if (step === 'confirm') return submitting ? '처리 중...' : '공유 요청';
    if (checkingAvailability) return '확인 중...';
    return '다음';
  }, [step, submitting, checkingAvailability]);

  return {
    // 권한
    hasDirectShare,
    permissionLoading,

    // 스텝 네비게이션
    step,
    steps,
    goNext,
    goPrev,
    isNextDisabled,
    nextButtonLabel,

    // 대상자
    targets,
    addTarget,
    removeTarget,
    targetType,
    setTargetType,

    // 대상자 검색
    targetSearch: {
      keyword: searchUser,
      setKeyword: setSearchUser,
      results: searchResults,
      loading: searchLoading,
    },

    // 승인자
    designatedApproverId,
    setDesignatedApproverId,
    designatedApprover,
    setDesignatedApprover,

    // 승인자 검색
    approverSearch: {
      keyword: approverSearchKeyword,
      setKeyword: setApproverSearchKeyword,
      results: approverResults,
      loading: approverSearchLoading,
    },

    // 설정
    permissionType,
    setPermissionType,
    maxDownloads,
    setMaxDownloads,
    startAt,
    setStartAt,
    endAt,
    setEndAt,
    reason,
    setReason,

    // 가용성 & 결과
    availability,
    checkingAvailability,
    submitting,
    result,

    // 파일 유효성 (폴더 API 기반)
    fileWarnings,
    hasBlockingWarnings,
    shareableFiles,
  };
}
