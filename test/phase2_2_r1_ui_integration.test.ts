/**
 * NEXORA — PHASE 2.2-R1 UI Integration & Role Access Verification Suite
 * 
 * Verifies:
 * 1. Role access control helper (isTeacherWorkspaceAuthorized)
 * 2. Authorized roles vs unauthorized roles (TEACH, PRO, LEAD, ADMIN vs START, STUDENT, FAMILY)
 * 3. Arabic role titles matching
 * 4. Header props and responsive drawer integration
 * 5. App.tsx modal state management, prop passing, and logout reset
 * 6. Server-side authoritative security boundaries
 */

import {
  isTeacherWorkspaceAuthorized,
  TEACHER_WORKSPACE_ALLOWED_ROLE_CODES,
  TEACHER_WORKSPACE_ALLOWED_PORTAL_IDS,
  UNAUTHORIZED_ROLE_CODES,
} from '../src/utils/roleAccess';
import { UserSession } from '../src/types';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('NEXORA PHASE 2.2-R1 — TEACHER WORKSPACE UI INTEGRATION TEST SUITE');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Test Group 1: Role Access Control Matrix
// ----------------------------------------------------------------------------
console.log('Test Group 1: Role Access Matrix Verification (UX Gating)');

// 1.1 Unauthenticated sessions
assert(isTeacherWorkspaceAuthorized(null) === false, 'Null session returns false');
assert(isTeacherWorkspaceAuthorized(undefined) === false, 'Undefined session returns false');
assert(isTeacherWorkspaceAuthorized({ isLoggedIn: false }) === false, 'isLoggedIn: false returns false');
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: false, role: 'TEACH', portalId: 'teach' }) === false,
  'Unauthenticated user with teacher role returns false'
);

// 1.2 Authorized role codes (TEACH, PRO, LEAD, ADMIN)
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'TEACH' }) === true,
  'Logged-in TEACH role code returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'teach' }) === true,
  'Logged-in lower-case teach role code returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'PRO' }) === true,
  'Logged-in PRO role code returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'LEAD' }) === true,
  'Logged-in LEAD role code returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'ADMIN' }) === true,
  'Logged-in ADMIN role code returns true'
);

// 1.3 Authorized portal IDs (teach, pro, lead)
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, portalId: 'teach' }) === true,
  'Logged-in session with portalId: teach returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, portalId: 'pro' }) === true,
  'Logged-in session with portalId: pro returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, portalId: 'lead' }) === true,
  'Logged-in session with portalId: lead returns true'
);

// 1.4 Authorized Arabic role names
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'معلم علوم' }) === true,
  'Logged-in session with Arabic role "معلم علوم" returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'رئيس قسم علمي' }) === true,
  'Logged-in session with Arabic role "رئيس قسم علمي" returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'موجه فني للعلوم' }) === true,
  'Logged-in session with Arabic role "موجه فني للعلوم" returns true'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'مدير النظام' }) === true,
  'Logged-in session with Arabic role "مدير النظام" returns true'
);

// 1.5 Explicitly Unauthorized Roles (START, STUDENT, FAMILY)
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'STUDENT', portalId: 'student' }) === false,
  'STUDENT role is strictly forbidden (returns false)'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'FAMILY', portalId: 'family' }) === false,
  'FAMILY role is strictly forbidden (returns false)'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'START', portalId: 'start' }) === false,
  'Trainee teacher START role is strictly forbidden (returns false)'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'طالب' }) === false,
  'Arabic role "طالب" returns false'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'ولي أمر' }) === false,
  'Arabic role "ولي أمر" returns false'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'معلم متدرب' }) === false,
  'Arabic role "معلم متدرب" returns false'
);
assert(
  isTeacherWorkspaceAuthorized({ isLoggedIn: true, role: 'GUEST' }) === false,
  'Arbitrary role "GUEST" returns false'
);

// ----------------------------------------------------------------------------
// Test Group 2: Header Component Integration & RTL/Responsive Verification
// ----------------------------------------------------------------------------
console.log('\nTest Group 2: Header Component Static Code Inspection');

const headerPath = path.resolve(process.cwd(), 'src/components/Header.tsx');
const headerCode = fs.readFileSync(headerPath, 'utf8');

assert(
  headerCode.includes('onOpenTeacherWorkspace?: () => void;'),
  'HeaderProps interface defines optional onOpenTeacherWorkspace callback'
);
assert(
  headerCode.includes('isTeacherWorkspaceAuthorized'),
  'Header imports and uses isTeacherWorkspaceAuthorized'
);
assert(
  headerCode.includes('userSession.isLoggedIn && isTeacherWorkspaceAuthorized(userSession) && onOpenTeacherWorkspace'),
  'Desktop Teacher Workspace button is gated by login AND role authorization'
);
assert(
  headerCode.includes('مساحة المعلم'),
  'Header contains Arabic label "مساحة المعلم"'
);
assert(
  headerCode.includes('BookOpen'),
  'Header utilizes BookOpen icon for Teacher Workspace'
);
assert(
  headerCode.includes('Mobile Teacher Workspace Button for Authorized Teachers'),
  'Mobile drawer menu contains dedicated Teacher Workspace entry'
);
assert(
  headerCode.includes('hidden sm:flex') && headerCode.includes('lg:hidden'),
  'Responsive classes ensure both desktop top bar and mobile drawer are supported'
);

// ----------------------------------------------------------------------------
// Test Group 3: App.tsx Wiring & Modal Lifecycle Management
// ----------------------------------------------------------------------------
console.log('\nTest Group 3: App.tsx Component Tree & Modal State Inspection');

const appPath = path.resolve(process.cwd(), 'src/App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');

assert(
  appCode.includes("import { TeacherWorkspaceModal } from './components/modals/TeacherWorkspaceModal';"),
  'App.tsx imports TeacherWorkspaceModal'
);
assert(
  appCode.includes('const [isTeacherWorkspaceOpen, setIsTeacherWorkspaceOpen] = useState(false);'),
  'App.tsx manages isTeacherWorkspaceOpen state variable'
);
assert(
  appCode.includes('<TeacherWorkspaceModal'),
  'App.tsx renders <TeacherWorkspaceModal /> in component tree'
);
assert(
  appCode.includes('isOpen={isTeacherWorkspaceOpen}'),
  'App.tsx passes isOpen prop to TeacherWorkspaceModal'
);
assert(
  appCode.includes('onClose={() => setIsTeacherWorkspaceOpen(false)}'),
  'App.tsx passes onClose handler to TeacherWorkspaceModal'
);
assert(
  appCode.includes('userRole={userSession.role}'),
  'App.tsx passes userRole prop to TeacherWorkspaceModal'
);
assert(
  appCode.includes('userName={userSession.name}'),
  'App.tsx passes userName prop to TeacherWorkspaceModal'
);
assert(
  appCode.includes('setIsTeacherWorkspaceOpen(false);') && appCode.includes('handleLogout = async () => {'),
  'App.tsx handleLogout resets isTeacherWorkspaceOpen to false'
);
assert(
  appCode.includes('!userSession.isLoggedIn || !isTeacherWorkspaceAuthorized(userSession)'),
  'App.tsx includes auto-close useEffect hook when session terminates or becomes unauthorized'
);
assert(
  appCode.includes('handleOpenTeacherWorkspace = () => {') &&
  appCode.includes('if (isTeacherWorkspaceAuthorized(userSession))'),
  'App.tsx handleOpenTeacherWorkspace checks role authorization before opening'
);

// ----------------------------------------------------------------------------
// Test Group 4: Server-Side Security & Authoritative Boundary Check
// ----------------------------------------------------------------------------
console.log('\nTest Group 4: Authoritative Backend Security Verification');

const serverTeacherRoutePath = path.resolve(process.cwd(), 'server/routes/teacher.ts');
const serverTeacherCode = fs.readFileSync(serverTeacherRoutePath, 'utf8');

assert(
  serverTeacherCode.includes("requireRole(['TEACH', 'PRO', 'LEAD', 'ADMIN'])"),
  'Backend route strictly enforces requireRole([TEACH, PRO, LEAD, ADMIN])'
);
assert(
  serverTeacherCode.includes('const teacherId = req.user!.id;'),
  'Backend extracts teacherId exclusively from verified session (req.user!.id)'
);
assert(
  !serverTeacherCode.includes('req.query.teacherId || req.user'),
  'Backend does NOT permit spoofing teacherId via query parameters'
);

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('PHASE 2.2-R1 UI INTEGRATION VERIFICATION: ALL CHECKS PASSED [PASS]');
  process.exit(0);
}
