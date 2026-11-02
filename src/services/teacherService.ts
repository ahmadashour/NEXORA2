/**
 * NEXORA Teacher Workspace Service
 * Interacts with /api/v1/teacher/* endpoints using credentials and JWT.
 */

import { apiClient } from './apiClient';
import {
  TeacherClassModel,
  ClassStudentModel,
  AttendanceRecordModel,
  AttendanceSummaryModel,
  CreateClassPayload,
  UpdateClassPayload,
  BatchAttendancePayload,
  CsvImportValidationResult,
} from '../types/contracts';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

function getHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const token = apiClient.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const csrf = apiClient.getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  return headers;
}

export class TeacherApiError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode = 500, errorCode = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'TeacherApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new TeacherApiError('فشل في قراءة استجابة الخادم', res.status, 'INVALID_JSON');
  }

  if (!res.ok || !body.success) {
    const errorMsg = body.message || body.error || 'حدث خطأ أثناء معالجة الطلب';
    const errorCode = body.error || `HTTP_${res.status}`;
    throw new TeacherApiError(errorMsg, res.status, errorCode);
  }

  return body.data as T;
}

export const teacherService = {
  /**
   * Fetches classes for current teacher
   */
  async getClasses(status?: 'active' | 'archived' | 'completed'): Promise<TeacherClassModel[]> {
    const url = new URL(`${API_BASE}/teacher/classes`, window.location.origin);
    if (status) url.searchParams.append('status', status);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    return handleResponse<TeacherClassModel[]>(res);
  },

  /**
   * Creates a new class
   */
  async createClass(payload: CreateClassPayload): Promise<TeacherClassModel> {
    const res = await fetch(`${API_BASE}/teacher/classes`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    return handleResponse<TeacherClassModel>(res);
  },

  /**
   * Gets single class details + student count & attendance stats
   */
  async getClassDetails(classId: string): Promise<TeacherClassModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}`, {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    return handleResponse<TeacherClassModel>(res);
  },

  /**
   * Updates class details
   */
  async updateClass(classId: string, payload: UpdateClassPayload): Promise<TeacherClassModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}`, {
      method: 'PUT',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    return handleResponse<TeacherClassModel>(res);
  },

  /**
   * Archives a class
   */
  async archiveClass(classId: string): Promise<TeacherClassModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/archive`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
    });

    return handleResponse<TeacherClassModel>(res);
  },

  /**
   * Regenerates a new join code
   */
  async regenerateJoinCode(classId: string): Promise<{ join_code: string }> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/regenerate-code`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
    });

    return handleResponse<{ join_code: string }>(res);
  },

  /**
   * Student joins a class via join code
   */
  async joinClassByCode(joinCode: string): Promise<any> {
    const res = await fetch(`${API_BASE}/teacher/classes/join`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ join_code: joinCode }),
    });

    return handleResponse<any>(res);
  },

  /**
   * Lists students enrolled in a class
   */
  async getClassStudents(classId: string): Promise<ClassStudentModel[]> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students`, {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    return handleResponse<ClassStudentModel[]>(res);
  },

  /**
   * Enrolls a student manually by ID
   */
  async enrollStudent(classId: string, studentId: string): Promise<ClassStudentModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ student_id: studentId }),
    });

    return handleResponse<ClassStudentModel>(res);
  },

  /**
   * Removes/drops a student from class
   */
  async removeStudent(classId: string, studentId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      headers: getHeaders(false),
      credentials: 'include',
    });

    await handleResponse<any>(res);
    return true;
  },

  /**
   * Validates CSV/Excel roster before import
   */
  async validateCsvImport(classId: string, records: any[]): Promise<CsvImportValidationResult> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students/validate-import`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ records }),
    });

    return handleResponse<CsvImportValidationResult>(res);
  },

  /**
   * Commits bulk import of students
   */
  async importStudents(classId: string, students: any[]): Promise<{ imported_count: number; students: ClassStudentModel[] }> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students/import`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ students }),
    });

    return handleResponse<{ imported_count: number; students: ClassStudentModel[] }>(res);
  },

  /**
   * Gets attendance records for date/session
   */
  async getAttendance(classId: string, date: string, session?: number): Promise<AttendanceRecordModel[]> {
    const url = new URL(`${API_BASE}/teacher/classes/${classId}/attendance`, window.location.origin);
    url.searchParams.append('date', date);
    if (session !== undefined) url.searchParams.append('session', String(session));

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    return handleResponse<AttendanceRecordModel[]>(res);
  },

  /**
   * Batch records attendance in atomic transaction
   */
  async recordAttendance(classId: string, payload: BatchAttendancePayload): Promise<AttendanceRecordModel[]> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/attendance`, {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    return handleResponse<AttendanceRecordModel[]>(res);
  },

  /**
   * Updates single attendance record
   */
  async updateAttendanceRecord(
    classId: string,
    recordId: string,
    payload: { status: string; notes?: string }
  ): Promise<AttendanceRecordModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/attendance/${recordId}`, {
      method: 'PATCH',
      headers: getHeaders(true),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    return handleResponse<AttendanceRecordModel>(res);
  },

  /**
   * Gets class attendance rate and summary
   */
  async getAttendanceSummary(classId: string): Promise<AttendanceSummaryModel> {
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/attendance/summary`, {
      method: 'GET',
      headers: getHeaders(false),
      credentials: 'include',
    });

    return handleResponse<AttendanceSummaryModel>(res);
  },
};
