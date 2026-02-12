/**
 * Admin Department API Client
 * 관리자 부서 정보 API (/v1/admin/departments)
 */
import axios, { AxiosError } from 'axios';
import type { DepartmentHierarchyResponse } from '../types/department.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
): Promise<T> {
  try {
    const response = await api.request<T>({
      method,
      url,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`[departmentApi] ${method} ${url} failed:`, axiosError.response?.status, axiosError.message);
    }
    throw error;
  }
}

export const departmentApi = {
  /**
   * 부서 계층 구조 조회
   * GET /v1/admin/departments
   */
  getHierarchy: (token: string): Promise<DepartmentHierarchyResponse[]> =>
    apiCall<DepartmentHierarchyResponse[]>('GET', '/admin/departments', token),
};

export default departmentApi;
