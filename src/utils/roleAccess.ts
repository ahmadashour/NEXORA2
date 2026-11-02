/**
 * NEXORA Role Access Control & Workspace Authorization Helpers
 * Phase P2.2-R1 Frontend Integration
 */
import { UserSession } from '../types';

/**
 * Roles authorized to access the Teacher Workspace:
 * - TEACH (معلم علوم / معلم)
 * - PRO (رئيس قسم علمي)
 * - LEAD (موجه فني للعلوم)
 * - ADMIN (مدير النظام)
 */
export const TEACHER_WORKSPACE_ALLOWED_ROLE_CODES = ['TEACH', 'PRO', 'LEAD', 'ADMIN'] as const;

export const TEACHER_WORKSPACE_ALLOWED_PORTAL_IDS = ['teach', 'pro', 'lead'] as const;

export const TEACHER_WORKSPACE_ALLOWED_ROLE_NAMES = [
  'معلم علوم',
  'معلم',
  'رئيس قسم علمي',
  'رئيس قسم',
  'موجه فني للعلوم',
  'موجه فني',
  'مدير النظام',
  'مسؤول النظام',
] as const;

/**
 * Roles explicitly unauthorized:
 * - START (معلم متدرب)
 * - STUDENT (طالب)
 * - FAMILY (ولي أمر)
 */
export const UNAUTHORIZED_ROLE_CODES = ['START', 'STUDENT', 'FAMILY'] as const;

export const UNAUTHORIZED_ARABIC_ROLES = [
  'معلم متدرب',
  'متدرب',
  'طالب',
  'ولي أمر',
  'زائر',
] as const;

/**
 * Determines whether a user session has permissions to view and open the Teacher Workspace.
 * Note: Client-side check is UX only; real security is enforced server-side via JWT & requireRole.
 */
export function isTeacherWorkspaceAuthorized(session?: UserSession | null): boolean {
  if (!session || !session.isLoggedIn) {
    return false;
  }

  // Check portalId if present
  if (session.portalId) {
    const portal = session.portalId.toLowerCase();
    // Exclude explicitly forbidden portals
    if (portal === 'student' || portal === 'family' || portal === 'start') {
      return false;
    }
    if (TEACHER_WORKSPACE_ALLOWED_PORTAL_IDS.includes(portal as any)) {
      return true;
    }
  }

  // Check role string if present
  if (session.role) {
    const trimmedRole = session.role.trim();
    const upperRole = trimmedRole.toUpperCase();

    // Check forbidden codes
    if (UNAUTHORIZED_ROLE_CODES.includes(upperRole as any)) {
      return false;
    }

    // Check forbidden Arabic roles (e.g. 'معلم متدرب' must not match 'معلم')
    for (const forbidden of UNAUTHORIZED_ARABIC_ROLES) {
      if (trimmedRole.includes(forbidden)) {
        return false;
      }
    }

    // Check allowed codes
    if (TEACHER_WORKSPACE_ALLOWED_ROLE_CODES.includes(upperRole as any)) {
      return true;
    }

    // Check Arabic role titles
    for (const allowedName of TEACHER_WORKSPACE_ALLOWED_ROLE_NAMES) {
      if (trimmedRole.includes(allowedName)) {
        return true;
      }
    }
  }

  return false;
}
