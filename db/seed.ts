import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { isLoopbackHost, isValidPostgresUrl } from '../server/db/postgres';

dotenv.config();

/**
 * NEXORA Phase 5 / P1.2 — Idempotent Database Seed Script
 * 
 * STRICT SAFETY RULES:
 * 1. Only runs against safe, isolated local test databases (e.g. 127.0.0.1 / localhost / test_db).
 * 2. Hard block if invoked in production or against remote production domains.
 * 3. Does NOT create admin accounts with default passwords.
 * 4. Distinctly marks all seeded entities with [TEST_SEED] prefix and 'اختبار' tags.
 * 5. Idempotent: Safe to re-run multiple times without data multiplication or constraint errors.
 */

export interface SeedResult {
  success: boolean;
  message: string;
  counts: {
    posts: number;
    resources: number;
    contentItems: number;
    eventDetails: number;
    inquiries: number;
  };
}

export function assertSafeDatabaseUrl(connString?: string): void {
  if (!connString || !isValidPostgresUrl(connString)) {
    throw new Error('SEED HALT: A valid DATABASE_URL must be provided for seeding.');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('SEED HALT: Database seeding is strictly forbidden in production mode.');
  }

  const lower = connString.toLowerCase();
  if (
    lower.includes('ashouracademy.com') ||
    lower.includes('hostinger') ||
    lower.includes('prod') ||
    lower.includes('production')
  ) {
    throw new Error(`SAFETY HALT: Attempted to run seed against dangerous remote database: ${connString}`);
  }

  const isLocal = isLoopbackHost(connString);
  if (!isLocal && !lower.includes('test')) {
    throw new Error(`SAFETY HALT: Seeding allowed only on local loopback or designated test databases.`);
  }
}

export async function runSeed(databaseUrl?: string): Promise<SeedResult> {
  const connString = databaseUrl || process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  assertSafeDatabaseUrl(connString);

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: connString,
    ssl: false,
    connectionTimeoutMillis: 8000,
  });

  const client = await pool.connect();

  try {
    console.log('[SEED] Connected to isolated test database. Starting idempotent seeding...');
    await client.query('BEGIN');

    // 1. Ensure a designated non-privileged test author exists
    const testAuthorId = 'usr_test_seed_author_01';
    await client.query(`
      INSERT INTO users (id, email, password_hash, role_id, is_active, email_verified, created_at, updated_at)
      VALUES ($1, 'test.author@nexora.local', '$2b$12$e9d2...unusable_seed_hash', 'role_teach', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING;
    `, [testAuthorId]);

    await client.query(`
      INSERT INTO user_profiles (id, user_id, full_name, phone, school_or_org, district, bio, preferences, created_at, updated_at)
      VALUES ('prof_test_seed_01', $1, 'أ. أحمد الشمري [عضو تجريبي]', '96590000001', 'مدرسة العلوم الحديثة', 'العاصمة', 'حساب تجريبي للبيئة المعزولة', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING;
    `, [testAuthorId]);

    // 2. Seed Community Posts (4 idempotent items)
    const seedPosts = [
      {
        id: 'post_seed_chem_01',
        title: '[TEST_SEED] استراتيجيات تدريس الروابط الأيونية والتساهمية للصف الحادي عشر',
        subject: 'كيمياء',
        grade_level: 'الصف الحادي عشر',
        summary: 'دليل تطبيقي ونماذج مجسمات ثلاثية الأبعاد لشرح الترابط الكيميائي.',
        content: 'يتناول هذا المحتوى نماذج تفاعلية مبسطة لتقريب مفهوم الترابط الأيوني والتساهمي لطلاب المرحلة الثانوية.',
        tags: ['كيمياء', 'ترابط_كيميائي', 'الصف_الحادي_عشر', 'اختبار'],
        status: 'published',
        is_pinned: true,
      },
      {
        id: 'post_seed_phys_02',
        title: '[TEST_SEED] محاكاة تجربة قانون أوم ودوائر التوالي والتوازي',
        subject: 'فيزياء',
        grade_level: 'الصف العاشر',
        summary: 'أوراق عمل مخبرية وحساب المقاومة المكافئة عملياً في المختبر المدرسي.',
        content: 'دليل عملي للمعلمين لتنفيذ تجربة قانون أوم باستخدام أجهزة القياس الرقمية والمحاكاة الافتراضية.',
        tags: ['فيزياء', 'كهرباء', 'قانون_أوم', 'اختبار'],
        status: 'published',
        is_pinned: false,
      },
      {
        id: 'post_seed_bio_03',
        title: '[TEST_SEED] بنك أسئلة الوراثة الجزيئية وتضاعف الحمض النووي DNA',
        subject: 'أحياء',
        grade_level: 'الصف الثاني عشر',
        summary: 'تجميع لأهم المسائل الوراثية وتطبيقات الهندسة الوراثية لاختبارات الثانوية العامة.',
        content: 'ملف شامل يحوي مسائل وراثية متدرجة الصعوبة ونماذج إجابة معتمدة لمادة الأحياء.',
        tags: ['أحياء', 'وراثة', 'DNA', 'اختبار'],
        status: 'published',
        is_pinned: false,
      },
      {
        id: 'post_seed_sci_04',
        title: '[TEST_SEED] مصفوفة كفايات العلوم للمرحلة المتوسطة وفق المعايير الوطنية',
        subject: 'علوم عامة',
        grade_level: 'الصف الثامن',
        summary: 'أداة تقويم تشخيصي لقياس نواتج التعلم وتطوير مهارات التفكير العلمي.',
        content: 'دليل إرشادي للمعلمين الجدد لبناء أدوات قياس وتقويم موضوعية في دروس العلوم العامة.',
        tags: ['علوم_عامة', 'كفايات', 'تقويم', 'اختبار'],
        status: 'published',
        is_pinned: false,
      },
    ];

    for (const p of seedPosts) {
      await client.query(`
        INSERT INTO community_posts (
          id, author_id, title, subject, grade_level, summary, content,
          status, likes_count, comments_count, bookmarks_count, views_count,
          is_pinned, tags, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, 0, 0, 0, 0,
          $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING;
      `, [p.id, testAuthorId, p.title, p.subject, p.grade_level, p.summary, p.content, p.status, p.is_pinned, p.tags]);
    }

    // 3. Seed Library Resources (4 idempotent items)
    const seedResources = [
      {
        id: 'res_seed_guide_01',
        title: '[TEST_SEED] دليل المعلم المعتمد لمختبرات الكيمياء الحديثة',
        category: 'guides',
        subject: 'كيمياء',
        grade_level: 'المرحلة الثانوية',
        publisher_name: 'التوجيه الفني للعلوم',
        file_url: 'https://storage.nexora.local/guides/chemistry-lab-guide-2026.pdf',
        file_size_bytes: 5242880, // 5MB
        file_type: 'pdf',
        mime_type: 'application/pdf',
      },
      {
        id: 'res_seed_book_02',
        title: '[TEST_SEED] بنك التجارب المخبرية في الميكانيكا الكلاسيكية',
        category: 'books',
        subject: 'فيزياء',
        grade_level: 'الصف الحادي عشر',
        publisher_name: 'أكاديمية العلوم',
        file_url: 'https://storage.nexora.local/books/physics-mechanics-lab.pdf',
        file_size_bytes: 8388608, // 8MB
        file_type: 'pdf',
        mime_type: 'application/pdf',
      },
      {
        id: 'res_seed_sheet_03',
        title: '[TEST_SEED] أوراق عمل التفاعلات الكيميائية وموازنة المعادلات',
        category: 'worksheets',
        subject: 'كيمياء',
        grade_level: 'الصف العاشر',
        publisher_name: 'قسم العلوم',
        file_url: 'https://storage.nexora.local/sheets/chemical-equations-ws.pdf',
        file_size_bytes: 1048576, // 1MB
        file_type: 'pdf',
        mime_type: 'application/pdf',
      },
      {
        id: 'res_seed_exam_04',
        title: '[TEST_SEED] نماذج اختبارات نهاية الفترة الدراسية للأحياء مع نماذج الإجابة',
        category: 'exams',
        subject: 'أحياء',
        grade_level: 'الصف الثاني عشر',
        publisher_name: 'التوجيه العام',
        file_url: 'https://storage.nexora.local/exams/biology-grade12-mock.pdf',
        file_size_bytes: 2097152, // 2MB
        file_type: 'pdf',
        mime_type: 'application/pdf',
      },
    ];

    for (const r of seedResources) {
      await client.query(`
        INSERT INTO library_resources (
          id, title, description, category, subject, grade_level, author_id,
          publisher_name, file_url, file_size_bytes, file_type, mime_type,
          status, downloads_count, views_count, created_at, updated_at
        ) VALUES (
          $1, $2, 'موارد تجريبية مخصصة لاختبارات التكامل والتطوير المعزول', $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          'published', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        r.id, r.title, r.category, r.subject, r.grade_level, testAuthorId,
        r.publisher_name, r.file_url, r.file_size_bytes, r.file_type, r.mime_type
      ]);
    }

    // 4. Seed Content Items & Event Details (4 items, 1 with event detail)
    const seedContent = [
      {
        id: 'cnt_seed_art_01',
        title: '[TEST_SEED] مستقبل تدريس العلوم بالذكاء الاصطناعي التوليدي',
        description: 'استعراض معمق لتطبيقات الذكاء الاصطناعي في إعداد الخطط الدرسية وتوليد بنوك الأسئلة الذكية.',
        category: 'article',
        subject: 'علوم عامة',
        grade_level: 'جميع المراحل',
        read_time_minutes: 6,
        featured: true,
      },
      {
        id: 'cnt_seed_vid_02',
        title: '[TEST_SEED] شرح تقنية المعايرة الحجمية بالتحليل الكهربائي',
        description: 'فيديو تعليمي عالي الدقة يوضح خطوات المعايرة المخبرية لتحديد تركيز الأحماض والقواعد بدقة.',
        category: 'video',
        subject: 'كيمياء',
        grade_level: 'الصف الثاني عشر',
        video_url: 'https://www.youtube.com/watch?v=mock_titration_2026',
        read_time_minutes: 12,
        featured: false,
      },
      {
        id: 'cnt_seed_news_03',
        title: '[TEST_SEED] انطلاق معرض العلوم والابتكار للعام الدراسي 2026/2027',
        description: 'إعلان تفصيلي عن مواعيد وشروط المشاركة في مسابقة الابتكارات العلمية للمدارس الثانوية.',
        category: 'news',
        subject: 'علوم عامة',
        grade_level: 'المرحلة الثانوية',
        read_time_minutes: 4,
        featured: false,
      },
      {
        id: 'cnt_seed_evt_04',
        title: '[TEST_SEED] ملتقى التوجيه الفني لتطوير كفايات معلمي الكيمياء 2026',
        description: 'ورشة عمل تدريبية مكثفة تستعرض أحدث استراتيجيات التعليم النشط وتجارب المحاكاة الافتراضية.',
        category: 'event',
        subject: 'كيمياء',
        grade_level: 'المرحلة الثانوية',
        read_time_minutes: 180,
        featured: true,
        event: {
          id: 'evt_seed_detail_01',
          event_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          duration_minutes: 120,
          location_type: 'virtual',
          location_address: 'منصة التدريب الافتراضية - NEXORA Live',
          speaker_name: 'د. فيصل العتيبي',
          speaker_title: 'خبير المناهج وطرق تدريس العلوم',
          seats_capacity: 50,
        },
      },
    ];

    for (const c of seedContent) {
      await client.query(`
        INSERT INTO content_items (
          id, title, description, category, subject, grade_level, author_id,
          thumbnail_url, video_url, read_time_minutes, status, featured,
          views_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          NULL, $8, $9, 'published', $10,
          0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        c.id, c.title, c.description, c.category, c.subject, c.grade_level, testAuthorId,
        c.video_url || null, c.read_time_minutes, c.featured
      ]);

      if (c.event) {
        await client.query(`
          INSERT INTO event_details (
            id, content_item_id, event_date, duration_minutes, location_type,
            location_address, speaker_name, speaker_title, seats_capacity,
            seats_booked, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) ON CONFLICT (id) DO NOTHING;
        `, [
          c.event.id, c.id, c.event.event_date, c.event.duration_minutes, c.event.location_type,
          c.event.location_address, c.event.speaker_name, c.event.speaker_title, c.event.seats_capacity
        ]);
      }
    }

    // 5. Seed Contact Inquiries (2 items)
    const seedInquiries = [
      {
        id: 'inq_seed_01',
        full_name: 'أحمد محمود العبدالله [تجريبي]',
        email: 'inquiry.test1@nexora.local',
        phone: '96591112233',
        subject: '[TEST_SEED] استفسار حول إضافة مذكرات الكيمياء للفصل الدراسي الثاني',
        message: 'السلام عليكم، أرجو الإفادة بموعد توفر النسخة المحدثة من كراسة التطبيقات العملية.',
        portal_code: 'TEACH',
      },
      {
        id: 'inq_seed_02',
        full_name: 'سارة خالد الدوسري [تجريبي]',
        email: 'inquiry.test2@nexora.local',
        phone: '96592223344',
        subject: '[TEST_SEED] طلب تفعيل ميزة تصدير تقارير المختبر الافتراضي',
        message: 'نرجو توفير إمكانية تنزيل تقارير الطلاب المعملية بصيغة PDF مباشرة.',
        portal_code: 'PRO',
      },
    ];

    for (const inq of seedInquiries) {
      await client.query(`
        INSERT INTO contact_inquiries (
          id, user_id, full_name, email, phone, subject, message,
          portal_code, status, admin_notes, assigned_to, created_at, updated_at
        ) VALUES (
          $1, NULL, $2, $3, $4, $5, $6,
          $7, 'received', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING;
      `, [inq.id, inq.full_name, inq.email, inq.phone, inq.subject, inq.message, inq.portal_code]);
    }

    await client.query('COMMIT');

    // Query counts
    const pCount = await client.query('SELECT COUNT(*) FROM community_posts WHERE id LIKE $1', ['post_seed_%']);
    const rCount = await client.query('SELECT COUNT(*) FROM library_resources WHERE id LIKE $1', ['res_seed_%']);
    const cCount = await client.query('SELECT COUNT(*) FROM content_items WHERE id LIKE $1', ['cnt_seed_%']);
    const eCount = await client.query('SELECT COUNT(*) FROM event_details WHERE id LIKE $1', ['evt_seed_%']);
    const iCount = await client.query('SELECT COUNT(*) FROM contact_inquiries WHERE id LIKE $1', ['inq_seed_%']);

    const counts = {
      posts: parseInt(pCount.rows[0].count, 10),
      resources: parseInt(rCount.rows[0].count, 10),
      contentItems: parseInt(cCount.rows[0].count, 10),
      eventDetails: parseInt(eCount.rows[0].count, 10),
      inquiries: parseInt(iCount.rows[0].count, 10),
    };

    console.log('[SEED] Seeding completed successfully. Verified counts:', counts);

    return {
      success: true,
      message: 'Idempotent test seed completed successfully.',
      counts,
    };
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SEED ERROR]', msg);
    return {
      success: false,
      message: `Seed failed: ${msg}`,
      counts: { posts: 0, resources: 0, contentItems: 0, eventDetails: 0, inquiries: 0 },
    };
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow direct CLI execution: tsx db/seed.ts
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('seed.ts')) {
  runSeed().then((res) => {
    console.log('[SEED RESULT]', JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  });
}
