/**
 * 체크섬 유틸리티
 * Web Crypto API를 사용한 SHA-256 해시 계산
 */
import type { ChecksumVerificationResult } from '../types/file.types';

/**
 * Blob의 SHA-256 체크섬 계산
 * Web Crypto API 사용 (브라우저 네이티브, 빠름)
 * 
 * @param blob 해시를 계산할 Blob
 * @returns SHA-256 해시 문자열 (소문자 hex)
 */
export async function calculateSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 대용량 파일 체크섬 계산 (진행률 콜백 지원)
 * 
 * @param blob 해시를 계산할 Blob
 * @param onProgress 진행률 콜백 (0-100)
 * @returns SHA-256 해시 문자열 (소문자 hex)
 */
export async function calculateSHA256WithProgress(
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Web Crypto API는 스트리밍을 지원하지 않으므로
  // ArrayBuffer 읽기 단계에서 진행률을 추적
  
  onProgress?.(0);
  
  // 파일 읽기 (50%)
  const buffer = await blob.arrayBuffer();
  onProgress?.(50);
  
  // 해시 계산 (50% -> 100%)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  onProgress?.(100);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 체크섬 검증
 * 
 * @param blob 다운로드된 파일 Blob
 * @param expectedChecksum 서버에서 받은 체크섬 (X-Checksum-SHA256)
 * @returns 검증 결과
 */
export async function verifyChecksum(
  blob: Blob,
  expectedChecksum: string
): Promise<ChecksumVerificationResult> {
  const actualChecksum = await calculateSHA256(blob);
  return {
    isValid: actualChecksum.toLowerCase() === expectedChecksum.toLowerCase(),
    expected: expectedChecksum.toLowerCase(),
    actual: actualChecksum.toLowerCase(),
  };
}

/**
 * 체크섬 검증 (진행률 콜백 지원)
 * 
 * @param blob 다운로드된 파일 Blob
 * @param expectedChecksum 서버에서 받은 체크섬
 * @param onProgress 진행률 콜백 (0-100)
 * @returns 검증 결과
 */
export async function verifyChecksumWithProgress(
  blob: Blob,
  expectedChecksum: string,
  onProgress?: (percent: number) => void
): Promise<ChecksumVerificationResult> {
  const actualChecksum = await calculateSHA256WithProgress(blob, onProgress);
  return {
    isValid: actualChecksum.toLowerCase() === expectedChecksum.toLowerCase(),
    expected: expectedChecksum.toLowerCase(),
    actual: actualChecksum.toLowerCase(),
  };
}

/**
 * 파일 크기에 따른 체크섬 계산 예상 시간 (ms)
 * 대략적인 추정치 (환경에 따라 다를 수 있음)
 * 
 * @param sizeBytes 파일 크기 (bytes)
 * @returns 예상 시간 (ms)
 */
export function estimateChecksumTime(sizeBytes: number): number {
  // 약 100MB/s 속도로 추정 (환경에 따라 다름)
  const bytesPerMs = 100 * 1024; // 100KB/ms
  return Math.ceil(sizeBytes / bytesPerMs);
}
