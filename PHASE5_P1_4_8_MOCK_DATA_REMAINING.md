# NEXORA — PHASE 5 / P1.4.8: Mock Data & Static Content Inventory
## Comprehensive Integration & Production Readiness Audit

**Status:** AUDIT COMPLETED — COMPLETE INVENTORY COMPILED  
**Date:** March 2025  
**Auditor:** NEXORA Technical Quality & Security Audit Team  
**Scope:** `src/data/mockData.ts`, Local Component Static Data, Real API vs Mock Data Mapping.

---

### 1. Executive Summary: Integration Status Overview

A central objective of Phase 5 is decoupling NEXORA from static mock placeholders and connecting active UI views to live backend API endpoints.

- **Sections Fully Migrated to Live REST API:**
  - Community (`useCommunity` -> `/api/v1/community/posts`)
  - Library (`useLibrary` -> `/api/v1/library/resources`)
  - Scientific Content (`useContent` -> `/api/v1/content`)
  - Events & Workshops (`useEvents` -> `/api/v1/events`)
  - Support & Contact (`useSupport` -> `/api/v1/support/inquiries`)
- **Sections Remaining on Mock / Static Frontend Data:**
  - Academy Courses (`AcademyModal.tsx`)
  - Virtual 3D Lab Catalog (`LabModal.tsx`)
  - Homepage Portals Grid (`PORTALS_DATA`)
  - Interactive Quick Chemistry Tools (`QUICK_TOOLS`)

---

### 2. Complete Inventory of `src/data/mockData.ts` (519 Lines)

| Data Constant | Lines in File | Original Purpose | Current Production Status | Consumer Components |
| :--- | :---: | :--- | :--- | :--- |
| `PORTALS_DATA` | 12–78 | Educational sub-portals (Lab, Academy, Library, etc.) | **Active Static UI Config** | `src/components/PortalsSection.tsx`, `Hero.tsx` |
| `QUICK_TOOLS` | 80–135 | Quick calculator shortcuts (Periodic table, Molar mass, Balancer) | **Active Static UI Config** | `src/components/QuickToolsSection.tsx` |
| `LATEST_CONTENT` | 137–245 | Articles, guides, study sheets | **Superseded by Live API** (Kept as fallback) | `src/components/LatestContentSection.tsx` (Fallback only) |
| `UPCOMING_EVENTS` | 247–320 | Exam revision workshops | **Superseded by Live API** (Kept as fallback) | `src/components/LatestContentSection.tsx` (Fallback only) |
| `CHEMISTRY_LIBRARY_RESOURCES` | 322–420 | Curricula PDF files & guides | **Superseded by Live API** (Kept as fallback) | `src/components/LibrarySection.tsx` (Fallback only) |
| `CHEMISTRY_COMMUNITY_POSTS` | 422–519 | Student discussions & questions | **Superseded by Live API** (Kept as fallback) | `src/components/CommunitySection.tsx` (Fallback only) |

---

### 3. Modals and Sub-Portals Detailed Audit

#### 3.1 Academy Portal (`src/components/AcademyModal.tsx`)
- **Data Source:** Local constant array `chemistryCourses` containing 6 Grade 10–12 Kuwaiti curriculum courses (Thermochemistry, Organic Chemistry, Chemical Equilibrium, Electrochemistry, Gas Laws, Solutions).
- **Backend Connection:** None at present. Courses, syllabus chapters, and video lectures are statically defined in the component.
- **Classification:** **Pending Future Backend Domain (Phase 6 Candidate)**.

#### 3.2 Virtual Chemistry Lab (`src/components/LabModal.tsx`)
- **Data Source:** Local constant array `labSimulations` containing 8 virtual chemistry lab experiences (Titration, Gas Law Simulation, Flame Test, Galvanic Cell, etc.).
- **Backend Connection:** None at present. Launch actions trigger embedded interactive HTML5/Three.js canvases.
- **Classification:** **Client-Side Simulation / Interactive Tool**. Does not require REST CRUD; may eventually need user progress tracking.

#### 3.3 Portals Section (`src/components/PortalsSection.tsx`)
- **Data Source:** `PORTALS_DATA` from `src/data/mockData.ts`.
- **Backend Connection:** None. These represent high-level platform architectural hubs with navigation routes and metadata.
- **Classification:** **Intentional Static UI Configuration**. Does not warrant dynamic database overhead unless portal directory becomes dynamic.

#### 3.4 Quick Chemistry Tools (`src/components/QuickToolsSection.tsx`)
- **Data Source:** `QUICK_TOOLS` from `src/data/mockData.ts`.
- **Backend Connection:** Client-side calculation tools (Molar mass calculator, equation balancer).
- **Classification:** **Intentional Client-Side Utilities**.

---

### 4. Mock Data Retention Rationale

Retaining `src/data/mockData.ts` during Phase 5 was an explicit safety constraint ("لا تحذف ملفات Mock Data"). This policy proved beneficial:
1. **Zero Downtime / Offline Resilience:** In the event of backend network latency or downtime, non-critical static sections continue rendering without breaking UI layouts.
2. **Deterministic UI Testing:** Unit tests can verify UI styling against known benchmark objects without spinning up backend mock services.
3. **Phased Migration:** Allows remaining sub-portals (Academy and Lab) to be scheduled cleanly for subsequent roadmap phases without disrupting the 5 live integrated domains.
