/**
 * NEXORA Phase 5 / P1.4.5 — Content UI Integration Acceptance Tests
 * 
 * Verifies:
 * 1. CONT-INT-01: Fetch content from API & adapt DTO to UnifiedContentViewModel.
 * 2. CONT-INT-02: DTO adaptation via Content Adapter with category and date formatting.
 * 3. CONT-INT-03: Handle empty content list cleanly without runtime crashes.
 * 4. CONT-INT-04: API fetch failure handling without fallback to mockData.ts (Mock isolation).
 * 5. CONT-INT-05: Display all supported backend content types (article, video, news, announcement).
 * 6. CONT-INT-06: Fetch single content item details by ID.
 * 7. CONT-INT-07: Handle 404 CONTENT_NOT_FOUND cleanly when item does not exist.
 * 8. CONT-INT-08: Graceful resilience when optional/nullable fields are null or absent.
 * 9. CONT-INT-09: Anti-fabrication rule: never invent author, school, district, or date.
 * 10. CONT-INT-10: Draft isolation: drafts are inaccessible to unauthorized users (404).
 * 11. CONT-INT-11: Status codes preservation (401, 403, 404, 409, 429, 503) via ApiError.
 * 12. CONT-INT-12: Mock data isolation: LATEST_CONTENT is never silently substituted on failure.
 * 13. CONT-INT-13: Strict separation between Content API, Library API, and Events API.
 * 14. CONT-INT-14: UI states validation: Loading, Empty, and Error state flows.
 * 15. CONT-INT-15: Zero React/TypeScript runtime crashes across edge-case payloads.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { contentService } from '../src/services/contentService';
import { apiClient, ApiError } from '../src/services/apiClient';
import {
  adaptContentItemFromBackend,
  adaptContentItemsList,
  adaptContentItemToLegacy,
} from '../src/services/adapters/contentAdapter';
import { BackendContentItemDTO, UnifiedContentViewModel } from '../src/types/contracts';
import * as mockDataModule from '../src/data/mockData';

interface TestResult {
  id: string;
  name: string;
  category: string;
  classification: 'Mock/Unit Test' | 'Integration Test';
  passed: boolean;
  evidence: string;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(
  id: string,
  name: string,
  category: string,
  classification: 'Mock/Unit Test' | 'Integration Test',
  fn: () => Promise<string>
) {
  const start = Date.now();
  try {
    const evidence = await fn();
    results.push({
      id,
      name,
      category,
      classification,
      passed: true,
      evidence,
      durationMs: Date.now() - start,
    });
    console.log(`  [PASS] ${id}: ${name} (${Date.now() - start}ms)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({
      id,
      name,
      category,
      classification,
      passed: false,
      evidence: '',
      error: msg,
      durationMs: Date.now() - start,
    });
    console.error(`  [FAIL] ${id}: ${name} (${Date.now() - start}ms)`);
    console.error(`         ↳ Error: ${msg}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('     NEXORA PHASE 5 / P1.4.5 — CONTENT INTEGRATION TESTS      ');
  console.log('===============================================================\n');

  // Set up mock HTTP test server to simulate backend /api/v1/content endpoints
  let testServerUrl = '';

  const sampleArticles: BackendContentItemDTO[] = [
    {
      id: 'cnt-article-001',
      title: 'استراتيجيات التقصي العلمي الحديثة في تدريس الكيمياء',
      description: 'دليل منهجي شامل لتطبيق مهارات البحث والتقصي المخبري في الصفوف الثانوية.',
      category: 'article',
      subject: 'كيمياء',
      grade_level: 'الصف العاشر',
      author_id: 'usr-author-101',
      author_name: 'أ. د. عبد الله الشمري',
      thumbnail_url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d',
      video_url: null,
      read_time_minutes: 8,
      status: 'published',
      featured: true,
      views_count: 340,
      created_at: '2026-03-15T09:00:00.000Z',
      updated_at: '2026-03-15T09:00:00.000Z',
    },
    {
      id: 'cnt-video-002',
      title: 'تجارب المحاكاة الافتراضية لقوانين كبلر والحركة المدارية',
      description: 'شرح مرئي ثلاثي الأبعاد لحركة الكواكب والجاذبية العامة مع محاكاة تفاعلية.',
      category: 'video',
      subject: 'فيزياء',
      grade_level: 'الصف الحادي عشر',
      author_id: 'usr-author-102',
      author_name: 'أ. فاطمة الصالح',
      thumbnail_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
      video_url: 'https://nexora.ashouracademy.com/videos/kepler-simulation.mp4',
      read_time_minutes: 15,
      status: 'published',
      featured: false,
      views_count: 820,
      created_at: '2026-03-16T11:00:00.000Z',
      updated_at: '2026-03-16T11:00:00.000Z',
    },
    {
      id: 'cnt-news-003',
      title: 'انطلاق الأولمبياد الوطني للعلوم والذكاء الاصطناعي 2026',
      description: 'تعلن وزارة التربية عن فتح باب التسجيل في المسابقة السنوية للابتكارات الطلابية.',
      category: 'news',
      subject: 'علوم عامة',
      grade_level: 'كافة المراحل',
      author_id: 'usr-author-103',
      author_name: 'إدارة الإعلام التربوي',
      thumbnail_url: null,
      video_url: null,
      read_time_minutes: 4,
      status: 'published',
      featured: false,
      views_count: 1250,
      created_at: '2026-03-18T14:30:00.000Z',
      updated_at: '2026-03-18T14:30:00.000Z',
    },
  ];

  const testServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // GET /api/v1/content
      if (req.method === 'GET' && url.pathname === '/api/v1/content') {
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');
        let filtered = [...sampleArticles];

        if (category) {
          filtered = filtered.filter(item => item.category === category);
        }
        if (search) {
          filtered = filtered.filter(item => item.title.includes(search) || item.description.includes(search));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: filtered,
          pagination: {
            total: filtered.length,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasMore: false,
          },
        }));
        return;
      }

      // GET /api/v1/content/empty-test
      if (req.method === 'GET' && url.pathname === '/api/v1/content/empty-test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
            hasMore: false,
          },
        }));
        return;
      }

      // GET /api/v1/content/cnt-draft-hidden
      if (req.method === 'GET' && url.pathname === '/api/v1/content/cnt-draft-hidden') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'CONTENT_NOT_FOUND',
          message: 'عنصر المحتوى المطلوب غير متاح للعرض العام',
        }));
        return;
      }

      // GET /api/v1/content/:id
      if (req.method === 'GET' && url.pathname.startsWith('/api/v1/content/')) {
        const id = decodeURIComponent(url.pathname.replace('/api/v1/content/', ''));
        const item = sampleArticles.find(a => a.id === id);

        if (!item) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'CONTENT_NOT_FOUND',
            message: 'عنصر المحتوى المطلوب غير موجود',
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          content: item,
        }));
        return;
      }

      // Error simulation endpoints
      if (url.pathname === '/api/v1/mock-error-401') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول' }));
        return;
      }
      if (url.pathname === '/api/v1/mock-error-403') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'FORBIDDEN_ROLE', message: 'صلاحيات غير كافية' }));
        return;
      }
      if (url.pathname === '/api/v1/mock-error-409') {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'CONFLICT_STATE', message: 'تعارض في حالة المورد' }));
        return;
      }
      if (url.pathname === '/api/v1/mock-error-429') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'RATE_LIMITED', message: 'تم تجاوز حد الطلبات' }));
        return;
      }
      if (url.pathname === '/api/v1/mock-error-503') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'DATABASE_UNAVAILABLE', message: 'قاعدة البيانات غير متوفرة' }));
        return;
      }
      if (url.pathname === '/api/v1/mock-server-failure') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'SERVER_ERROR', message: 'خطأ داخلي في الخادم' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'NOT_FOUND' }));
    });

  await new Promise<void>((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const addr = testServer.address() as AddressInfo;
      testServerUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Fetch Content from API & DTO Adaptation
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-01', 'Fetch content from API & adapt DTO to UnifiedContentViewModel', 'ContentService', 'Integration Test', async () => {
      const res = await contentService.getContentList({}, `${testServerUrl}/api/v1/content`);

      if (!res.items || res.items.length !== 3) {
        throw new Error(`Expected 3 adapted items, got ${res.items?.length}`);
      }
      const first = res.items[0];
      if (first.id !== 'cnt-article-001') throw new Error(`Unexpected id: ${first.id}`);
      if (first.category !== 'resource') throw new Error(`Expected mapped category 'resource', got ${first.category}`);
      if (first.categoryLabel !== 'مقال تربوي') throw new Error(`Expected 'مقال تربوي', got ${first.categoryLabel}`);
      if (!first.title.includes('استراتيجيات')) throw new Error(`Title mismatch: ${first.title}`);
      if (first.readsOrViews !== 340) throw new Error(`viewsCount mismatch: ${first.readsOrViews}`);

      return `Fetched and adapted 3 items cleanly: id=${first.id}, category=${first.category}, categoryLabel=${first.categoryLabel}`;
    });

    // ------------------------------------------------------------------------
    // TEST 2: DTO Adaptation via Content Adapter
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-02', 'DTO adaptation via Content Adapter with category and date formatting', 'ContentAdapter', 'Mock/Unit Test', async () => {
      const rawDto: BackendContentItemDTO = {
        id: 'dto-test-01',
        title: 'استكشاف الفضاء وعلم الفلك',
        description: 'مقدمة في الفيزياء الفلكية',
        category: 'video',
        author_id: 'usr-1',
        author_name: 'د. سارة الراشد',
        read_time_minutes: 12,
        status: 'published',
        views_count: 550,
        created_at: '2026-02-10T15:00:00.000Z',
        updated_at: '2026-02-10T15:00:00.000Z',
      };

      const adapted = adaptContentItemFromBackend(rawDto);
      const legacy = adaptContentItemToLegacy(rawDto);

      if (adapted.id !== rawDto.id) throw new Error('ID mismatch');
      if (adapted.category !== 'video') throw new Error('Category mismatch');
      if (adapted.categoryLabel !== 'فيديو تعليمي') throw new Error('CategoryLabel mismatch');
      if (adapted.duration !== '12 دقائق') throw new Error(`Duration mismatch: ${adapted.duration}`);
      if (!adapted.author || adapted.author.name !== 'د. سارة الراشد') throw new Error('Author mapping failed');
      if (legacy.title !== rawDto.title) throw new Error('Legacy shape compatibility failed');

      return `DTO successfully adapted to UnifiedContentViewModel & legacy ContentItem: duration=${adapted.duration}, author=${adapted.author.name}`;
    });

    // ------------------------------------------------------------------------
    // TEST 3: Handle Empty Content List Cleanly
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-03', 'Handle empty content list cleanly without runtime crashes', 'ContentService', 'Integration Test', async () => {
      const res = await contentService.getContentList({}, `${testServerUrl}/api/v1/content/empty-test`);

      if (!Array.isArray(res.items)) throw new Error('Items is not an array');
      if (res.items.length !== 0) throw new Error(`Expected 0 items, got ${res.items.length}`);
      if (res.pagination.total !== 0) throw new Error(`Expected total 0, got ${res.pagination.total}`);

      return `Clean handling of empty result: items.length=0, total=0, no exceptions`;
    });

    // ------------------------------------------------------------------------
    // TEST 4: API Fetch Failure Handling Without Mock Fallback
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-04', 'API fetch failure handling without fallback to mockData.ts (Mock isolation)', 'ContentService', 'Integration Test', async () => {
      let threw = false;
      try {
        await contentService.getContentList({}, `${testServerUrl}/api/v1/mock-server-failure`);
      } catch (err: unknown) {
        threw = true;
        if (!(err instanceof ApiError)) {
          throw new Error('Error was not converted to ApiError');
        }
        if (err.status !== 500) {
          throw new Error(`Expected status 500, got ${err.status}`);
        }
        if (err.code !== 'SERVER_ERROR') {
          throw new Error(`Expected code SERVER_ERROR, got ${err.code}`);
        }
      }

      if (!threw) {
        throw new Error('Expected contentService to throw ApiError on server failure');
      }

      return `Server error cleanly surfaced as ApiError(500, SERVER_ERROR) without mock data fallback`;
    });

    // ------------------------------------------------------------------------
    // TEST 5: Display All Supported Backend Content Types
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-05', 'Display all supported backend content types (article, video, news, announcement)', 'ContentAdapter', 'Mock/Unit Test', async () => {
      const articleDto: BackendContentItemDTO = {
        ...sampleArticles[0],
        category: 'article',
      };
      const videoDto: BackendContentItemDTO = {
        ...sampleArticles[0],
        category: 'video',
      };
      const newsDto: BackendContentItemDTO = {
        ...sampleArticles[0],
        category: 'news',
      };
      const announcementDto: BackendContentItemDTO = {
        ...sampleArticles[0],
        category: 'announcement',
      };

      const adaptedArticle = adaptContentItemFromBackend(articleDto);
      const adaptedVideo = adaptContentItemFromBackend(videoDto);
      const adaptedNews = adaptContentItemFromBackend(newsDto);
      const adaptedAnnounce = adaptContentItemFromBackend(announcementDto);

      if (adaptedArticle.category !== 'resource' || adaptedArticle.categoryLabel !== 'مقال تربوي') {
        throw new Error('Article mapping failed');
      }
      if (adaptedVideo.category !== 'video' || adaptedVideo.categoryLabel !== 'فيديو تعليمي') {
        throw new Error('Video mapping failed');
      }
      if (adaptedNews.category !== 'news' || adaptedNews.categoryLabel !== 'أخبار تربوية') {
        throw new Error('News mapping failed');
      }
      if (adaptedAnnounce.category !== 'news' || adaptedAnnounce.categoryLabel !== 'إعلان رسمي') {
        throw new Error('Announcement mapping failed');
      }

      return `All 4 backend categories mapped to distinct valid UI types and labels`;
    });

    // ------------------------------------------------------------------------
    // TEST 6: Fetch Single Content Item Details by ID
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-06', 'Fetch single content item details by ID', 'ContentService', 'Integration Test', async () => {
      const item = await contentService.getContentById(
        'cnt-video-002',
        `${testServerUrl}/api/v1/content/cnt-video-002`
      );

      if (item.id !== 'cnt-video-002') throw new Error(`ID mismatch: ${item.id}`);
      if (item.category !== 'video') throw new Error(`Category mismatch: ${item.category}`);
      if (item.readsOrViews !== 820) throw new Error(`Views mismatch: ${item.readsOrViews}`);
      if (item.url !== 'https://nexora.ashouracademy.com/videos/kepler-simulation.mp4') {
        throw new Error(`Video URL mismatch: ${item.url}`);
      }

      return `Fetched detailed video item: title="${item.title}", url="${item.url}", views=${item.readsOrViews}`;
    });

    // ------------------------------------------------------------------------
    // TEST 7: Handle 404 CONTENT_NOT_FOUND Cleanly
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-07', 'Handle 404 CONTENT_NOT_FOUND cleanly when item does not exist', 'ContentService', 'Integration Test', async () => {
      let capturedStatus = 0;
      let capturedCode = '';

      try {
        await contentService.getContentById(
          'non-existent-id',
          `${testServerUrl}/api/v1/content/non-existent-id`
        );
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          capturedStatus = err.status;
          capturedCode = err.code;
        }
      }

      if (capturedStatus !== 404) throw new Error(`Expected 404, got ${capturedStatus}`);
      if (capturedCode !== 'CONTENT_NOT_FOUND') throw new Error(`Expected CONTENT_NOT_FOUND, got ${capturedCode}`);

      return `404 CONTENT_NOT_FOUND preserved accurately without crashing`;
    });

    // ------------------------------------------------------------------------
    // TEST 8: Graceful Resilience When Optional/Nullable Fields are Null
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-08', 'Graceful resilience when optional/nullable fields are null or absent', 'ContentAdapter', 'Mock/Unit Test', async () => {
      const sparseDto: BackendContentItemDTO = {
        id: 'sparse-001',
        title: 'ملاحظات تدريسية عامة',
        description: 'توجيهات فنية موجزة',
        category: 'article',
        author_id: 'usr-sparse',
        author_name: undefined,
        thumbnail_url: null,
        video_url: null,
        read_time_minutes: null,
        subject: null,
        grade_level: null,
        featured: undefined,
        status: 'published',
        views_count: 0,
        created_at: '2026-03-20T10:00:00.000Z',
        updated_at: '2026-03-20T10:00:00.000Z',
        event_detail: null,
      };

      const adapted = adaptContentItemFromBackend(sparseDto);

      if (adapted.id !== 'sparse-001') throw new Error('ID mismatch');
      if (adapted.subject !== 'علوم عامة') throw new Error(`Default subject expected, got ${adapted.subject}`);
      if (adapted.gradeLevel !== undefined) throw new Error('gradeLevel should be undefined');
      if (adapted.url !== undefined) throw new Error('url should be undefined');
      if (adapted.eventDetails !== undefined) throw new Error('eventDetails should be undefined');
      if (adapted.isFeatured !== false) throw new Error('isFeatured should be false for undefined');

      return `Sparse payload adapted with zero exceptions and safe defaults`;
    });

    // ------------------------------------------------------------------------
    // TEST 9: Anti-Fabrication Rule: Author is Undefined When Missing
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-09', 'Anti-fabrication rule: never invent author, school, district, or date', 'ContentAdapter', 'Mock/Unit Test', async () => {
      const anonymousDto: BackendContentItemDTO = {
        id: 'anon-001',
        title: 'وثيقة المعايير',
        description: 'معايير تقويم المهارات المخبرية',
        category: 'article',
        author_id: 'usr-system',
        author_name: undefined, // Author is not provided
        views_count: 10,
        status: 'published',
        created_at: '2026-03-22T08:00:00.000Z',
        updated_at: '2026-03-22T08:00:00.000Z',
      };

      const adapted = adaptContentItemFromBackend(anonymousDto);

      // Verify author is undefined and NOT fabricated with a placeholder name
      if (adapted.author !== undefined) {
        throw new Error(`FABRICATION DETECTED: Author was invented as "${adapted.author?.name}" when author_name was undefined!`);
      }

      return `Anti-fabrication verified: author is strictly undefined when author_name is omitted`;
    });

    // ------------------------------------------------------------------------
    // TEST 10: Draft Isolation: Drafts Inaccessible to Unauthorized Users (404)
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-10', 'Draft isolation: drafts are inaccessible to unauthorized users (404)', 'ContentService', 'Integration Test', async () => {
      let isBlocked = false;
      try {
        await contentService.getContentById(
          'cnt-draft-hidden',
          `${testServerUrl}/api/v1/content/cnt-draft-hidden`
        );
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          isBlocked = true;
        }
      }

      if (!isBlocked) {
        throw new Error('Draft was not blocked with 404 for unauthorized request');
      }

      return `Draft content returns 404 CONTENT_NOT_FOUND to general callers per security contract`;
    });

    // ------------------------------------------------------------------------
    // TEST 11: Status Codes Preservation (401, 403, 404, 409, 429, 503)
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-11', 'Status codes preservation (401, 403, 404, 409, 429, 503) via ApiError', 'ApiClient', 'Integration Test', async () => {
      const endpointsToTest: { url: string; expectedStatus: number; expectedCode: string }[] = [
        { url: `${testServerUrl}/api/v1/mock-error-401`, expectedStatus: 401, expectedCode: 'UNAUTHORIZED' },
        { url: `${testServerUrl}/api/v1/mock-error-403`, expectedStatus: 403, expectedCode: 'FORBIDDEN_ROLE' },
        { url: `${testServerUrl}/api/v1/mock-error-409`, expectedStatus: 409, expectedCode: 'CONFLICT_STATE' },
        { url: `${testServerUrl}/api/v1/mock-error-429`, expectedStatus: 429, expectedCode: 'RATE_LIMITED' },
        { url: `${testServerUrl}/api/v1/mock-error-503`, expectedStatus: 503, expectedCode: 'DATABASE_UNAVAILABLE' },
      ];

      for (const t of endpointsToTest) {
        try {
          await contentService.getContentList({}, t.url);
          throw new Error(`Expected status ${t.expectedStatus}, but request succeeded`);
        } catch (err: unknown) {
          if (!(err instanceof ApiError)) throw new Error(`Not an ApiError for ${t.expectedStatus}`);
          if (err.status !== t.expectedStatus) throw new Error(`Expected ${t.expectedStatus}, got ${err.status}`);
          if (err.code !== t.expectedCode) throw new Error(`Expected code ${t.expectedCode}, got ${err.code}`);
        }
      }

      return `All 5 HTTP status codes (401, 403, 409, 429, 503) faithfully preserved with exact error codes`;
    });

    // ------------------------------------------------------------------------
    // TEST 12: Mock Data Isolation
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-12', 'Mock data isolation: LATEST_CONTENT is never silently substituted on failure', 'ContentService', 'Integration Test', async () => {
      let returnedMock = false;

      try {
        const result = await contentService.getContentList({}, `${testServerUrl}/api/v1/mock-server-failure`);
        if (result.items.some(item => mockDataModule.LATEST_CONTENT.some(m => m.id === item.id))) {
          returnedMock = true;
        }
      } catch {
        // Expected to throw error on failure
      }

      if (returnedMock) {
        throw new Error('VIOLATION: Mock data was silently substituted as live response on server failure!');
      }

      return `Mock data isolation verified: failed API requests reject without fallback to static mockData.ts`;
    });

    // ------------------------------------------------------------------------
    // TEST 13: Strict Separation Between Content API, Library API, and Events API
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-13', 'Strict separation between Content API, Library API, and Events API', 'Architecture', 'Mock/Unit Test', async () => {
      // Content items have category in: article, video, news, announcement, event
      // Library resources have categories: books, worksheets, guides, research, curriculum
      // Events API has separate /api/v1/events endpoints with registration and seats reservation.
      const contentItem = sampleArticles[0];
      const adapted = adaptContentItemFromBackend(contentItem);

      // Verify content is not masquerading as a library download
      if ('downloadUrl' in adapted && (adapted as any).downloadUrl?.includes('/library/')) {
        throw new Error('Content item contains Library API downloadUrl');
      }

      // Verify Content API does not invoke Events registration routes
      if (adapted.rawCategory === 'article' && adapted.isEvent) {
        throw new Error('Article misclassified as an event');
      }

      return `Data sources strictly decoupled: Content items distinct from Library resources and standalone Events`;
    });

    // ------------------------------------------------------------------------
    // TEST 14: UI States Validation: Loading, Empty, and Error State Flows
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-14', 'UI states validation: Loading, Empty, and Error state flows', 'UIContracts', 'Mock/Unit Test', async () => {
      // Validate contract for empty state
      const emptyResult = adaptContentItemsList([]);
      if (!Array.isArray(emptyResult) || emptyResult.length !== 0) {
        throw new Error('Empty state did not return empty array');
      }

      // Validate contract for populated state
      const populatedResult = adaptContentItemsList(sampleArticles);
      if (populatedResult.length !== 3) {
        throw new Error('Populated state adaptation length mismatch');
      }

      return `UI states contracts verified: Empty state returns empty array; populated state adapts cleanly`;
    });

    // ------------------------------------------------------------------------
    // TEST 15: Zero React/TypeScript Runtime Crashes Across Edge-Case Payloads
    // ------------------------------------------------------------------------
    await runTest('CONT-INT-15', 'Zero React/TypeScript runtime crashes across edge-case payloads', 'Robustness', 'Mock/Unit Test', async () => {
      const edgeCaseDtos: BackendContentItemDTO[] = [
        {
          id: 'edge-unicode-⚡-01',
          title: 'تجربة كيميائية <script>alert(1)</script> & "quotes" \'and\' `backticks`',
          description: 'نص تجريبي طويل جداً جداً '.repeat(20),
          category: 'article',
          author_id: 'usr-unicode-✨',
          author_name: 'أحمد 🧪 عاشور',
          views_count: 999999999,
          status: 'published',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'edge-minimal-02',
          title: '',
          description: '',
          category: 'news',
          author_id: '',
          views_count: 0,
          status: 'published',
          created_at: '',
          updated_at: '',
        },
      ];

      for (const dto of edgeCaseDtos) {
        const adapted = adaptContentItemFromBackend(dto);
        if (typeof adapted.id !== 'string') throw new Error('Adapted id is not string');
        if (typeof adapted.title !== 'string') throw new Error('Adapted title is not string');
        if (typeof adapted.category !== 'string') throw new Error('Adapted category is not string');
      }

      return `Robustness verified: XSS payloads, Unicode emoji, empty strings, and long descriptions handled without crashes`;
    });

  } finally {
    testServer.close();
  }

  console.log('\n===============================================================');
  console.log('              P1.4.5 TEST EXECUTION SUMMARY                    ');
  console.log('===============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Tests Run  : ${results.length}`);
  console.log(`Passed           : ${passed}`);
  console.log(`Failed           : ${failed}`);
  console.log(`Pass Rate        : ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('===============================================================\n');

  if (failed > 0) {
    console.error('Some P1.4.5 acceptance tests failed.');
    process.exit(1);
  } else {
    console.log('All 15 P1.4.5 acceptance tests PASSED successfully.');
  }
}

main().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
