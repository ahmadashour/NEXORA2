import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication, rate limiter, and AI permission check to all AI routes
router.use(authMiddleware);
router.use(requirePermission('ai:access'));
router.use(aiLimiter);

// Curated curriculum science prompts bank for instant accurate response
const CURATED_SCIENCE_RESPONSES: Record<string, string> = {
  'صياغة خطة نشاط استقصائي لدرس التوازن الكيميائي': `خطة نشاط استقصائي: أثر تغير التركيز على موضع الاتزان (قاعدة لوشاتيليه)

🎯 الأهداف السلوكية:
1. يتوقع الطالب اتجاه انزياح موضع الاتزان عند إضافة مادة متفاعلة.
2. يلاحظ التغير اللوني في تفاعل أيونات الحديد (III) مع أيونات الثيوسيانات.
3. يستنتج قاعدة لوشاتيليه من خلال الملاحظة التجريبية الدقيقة.

🧪 المواد والأدوات المعملية:
- محلول كلوريد الحديد الثلاثي (FeCl₃) تركيز 0.05M.
- محلول ثيوسيانات البوتاسيوم (KSCN) تركيز 0.05M.
- 4 أنابيب اختبار وحامل أنابيب وماصات مدرجة.

📋 خطوات سير الحصة:
1. التهيئة (5 دقائق): طرح تساؤل تفاعلي عن أثر العوامل الخارجية على الأنظمة المتزنة.
2. التنفيذ الاستقصائي (15 دقيقة): مزج المحاليل وملاحظة التغير اللوني ومقارنته بالأنبوب الشاهد.
3. التفسير والمناقشة (10 دقائق): استنتاج قاعدة لوشاتيليه وتطبيقها على أمثلة صناعية وبيئية.`,

  'مصفوفة معايير (Rubric) لتقييم مهارات الطالب في المختبر': `مصفوفة تقييم المهارات العملية والأداء المخبري (Rubric)

المعيار الأول: إجراءات الأمن والسلامة (3 درجات)
- ممتاز (3): ارتداء المعطف والنظارات الواقية، والالتزام التام بتعليمات التعامل مع المواد الكيميائية.
- جيد (2): التزام عام مع حاجة لتنبيه طفيف في ترتيب سطح الطاولة.
- يحتاج تحسين (1): إهمال أحد متطلبات السلامة.

المعيار الثاني: الدقة في القياس ورصد البيانات (4 درجات)
- ممتاز (4): قراءة مستويات السوائل عند قاع التقعر بدقة، وتدوين الوحدات في الجداول بشكل صحيح.
- جيد (2-3): دقة مقبولة في القياس مع خطأ طفيف في تسجيل المنازل العشرية.
- يحتاج تحسين (1): قراءات غير دقيقة أو إهمال تسجيل الوحدات.

المعيار الثالث: النظافة وإعادة الأجهزة إلى حالتها (3 درجات)
- ممتاز (3): غسل الزجاجيات وتجفيفها وفصل مصادر التيار الكهربائي وإعادة الكواشف لأماكنها.`,

  'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر': `شرح مبسط: كيف نولد الكهرباء من الحركة والمغناطيس؟

المفهوم الأساسي:
تخيل أن خطوط المجال المغناطيسي هي مسارات طاقة غير مرئية. طالما أن المغناطيس ثابت داخل الملف، لا يتدفق أي تيار.
ولكن بمجرد تحريك المغناطيس بالنسبة للملف، يحدث تغير في التدفق المغناطيسي الذي يجتاز الحلقات، فيتولد فرق جهد وتيار كهربائي حثي.

قانون فاراداي:
تتناسب القوة الدافعة الكهربائية الحثية المتولدة طردياً مع المعدل الزمني لتغير التدفق المغناطيسي وعدد لفات الملف.

تطبيقات واقعية:
1. المولدات الكهربائية (الدينامو).
2. تقنية الشحن اللاسلكي.
3. مواقد الحث الكهرومغناطيسي الحديثة.`,

  'تجارب منزلية آمنة توضح تفاعلات الأكسدة والاختزال': `تجارب علمية منزلية آمنة: كيمياء الأكسدة والاختزال في المطبخ

1. تجربة: تلميع الفضيات المسودة برقائق الألومنيوم والملح
- الفكرة: كبريتيد الفضة (الطبقة السوداء) يختزل ويعود فضة لامعة، بينما يتأكسد الألومنيوم لأنه أنشط كيميائياً.
- المواد: وعاء زجاجي مبطن بورق ألومنيوم، ماء مغلي، ملعقة بيكربونات صوديوم، والقطعة الفضية.
- المشاهدة: عودة اللمعان في ثوانٍ مع تفاعل كهروكيميائي آمن تماماً.

2. تجربة: حماية شرائح التفاح من الأكسدة بفيتامين C
- الفكرة: إنزيم البوليفينول أوكسيديز يؤكسد المركبات الفينولية في التفاح فتتحول للون البني، ويعمل فيتامين C كمانع أكسدة فعال.`
};

router.post('/chat', async (req: AuthRequest, res: Response) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'INVALID_PROMPT',
      message: 'يرجى إدخال نص الاستفسار أو الطلب العلمي.',
    });
    return;
  }

  const trimmedPrompt = prompt.trim();

  // Enforce prompt length boundary
  if (trimmedPrompt.length > 2000) {
    res.status(400).json({
      success: false,
      error: 'PROMPT_TOO_LONG',
      message: 'نص الاستفسار يتجاوز الحد الأقصى المسموح به (2000 حرف).',
    });
    return;
  }

  // 1. Check curated responses bank
  if (CURATED_SCIENCE_RESPONSES[trimmedPrompt]) {
    res.json({
      success: true,
      reply: CURATED_SCIENCE_RESPONSES[trimmedPrompt],
      source: 'nexora-curriculum-engine',
    });
    return;
  }

  // 2. Call Gemini API if API key is configured with strict 10s timeout
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const apiCall = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: trimmedPrompt,
        config: {
          systemInstruction: 'أنت المساعد الذكي لمنظومة NEXORA التعليمية المتخصصة في العلوم والمختبرات والمناهج التربوية الحديثة. أجب باللغة العربية بأسلوب تربوي علمي رصين وموثق، وقدم خطوات واضحة ومقترحات عملية للتطبيق المعملي والتعليمي.',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI_TIMEOUT')), 10000)
      );

      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.text || '';

      res.json({
        success: true,
        reply: text,
        source: 'gemini-2.5-flash',
      });
      return;
    } catch (apiError: unknown) {
      const errMsg = apiError instanceof Error ? apiError.message : 'Unknown AI error';
      if (errMsg === 'AI_TIMEOUT') {
        res.status(504).json({
          success: false,
          error: 'AI_TIMEOUT',
          message: 'استغرق المساعد الذكي وقتاً أطول من المتوقع (أكثر من 10 ثوانٍ). يرجى إعادة المحاولة بصياغة أقصر.',
        });
        return;
      }
      console.warn('[NEXORA AI] Gemini generation error:', errMsg);
    }
  }

  // 3. If Gemini is not configured or failed, and not in curated responses, reject gracefully
  res.status(503).json({
    success: false,
    error: 'AI_SERVICE_UNAVAILABLE',
    message: 'خدمة المساعد الذكي التوليدي غير متوفرة حالياً. يمكنك استخدام الأسئلة الاسترشادية الجاهزة للمناهج.',
  });
});

export default router;
