import React, { useState } from 'react';
import { X, Bot, Send, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const quickPrompts = [
    'صياغة خطة نشاط استقصائي لدرس التوازن الكيميائي',
    'مصفوفة معايير (Rubric) لتقييم مهارات الطالب في المختبر',
    'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر',
    'تجارب منزلية آمنة توضح تفاعلات الأكسدة والاختزال'
  ];

  const defaultResponses: Record<string, string> = {
    'صياغة خطة نشاط استقصائي لدرس التوازن الكيميائي': `خطة نشاط استقصائي: أثر تغير التركيز على موضع الاتزان (قاعدة لوشاتيليه)

🎯 الأهداف السلوكية:
1. يتوقع الطالب اتجاه انزياح موضع الاتزان عند إضافة مادة متفاعلة.
2. يلاحظ التغير اللوني في تفاعل أيونات الحديد (III) مع أيونات الثيوسيانات.
3. يستنتج قاعدة لوشاتيليه من خلال الملاحظة التجريبية الدقيقة.

🧪 المواد والأدوات المعملية:
- محلول كلوريد الحديد الثلاثي (FeCl₃) تركيز 0.05M (أصفر باهت).
- محلول ثيوسيانات البوتاسيوم (KSCN) تركيز 0.05M (عديم اللون).
- 4 أنابيب اختبار وحامل أنابيب وماصات مدرجة.

📋 خطوات سير الحصة:
1. التهيئة (5 دقائق): طرح تساؤل: ماذا يحدث للون الشاي عند إضافة الليمون؟ وربط ذلك بالاتزان.
2. التنفيذ الاستقصائي (15 دقيقة): مزج كميات متساوية للحصول على لون أحمر دموي (Fe(SCN)²⁺)، ثم تجزئة المحلول في أنابيب وإضافة مزيد من أحد المتفاعلين في الأنبوب الأول وتبريد الثاني.
3. التفسير والمناقشة (10 دقائق): صياغة الاستنتاج بلغة علمية دقيقة وفق قاعدة لوشاتيليه.`,

    'مصفوفة معايير (Rubric) لتقييم مهارات الطالب في المختبر': `مصفوفة تقييم المهارات العملية والأداء المخبري (Rubric)

المعيار الأول: إجراءات الأمن والسلامة (3 درجات)
- ممتاز (3): ارتداء المعطف والنظارات الواقية، الالتزام التام بتعليمات التعامل مع المواد الكيميائية.
- جيد (2): التزام عام مع حاجة لتنبيه طفيف في ترتيب سطح الطاولة.
- يحتاج تحسين (1): إهمال أحد متطلبات السلامة.

المعيار الثاني: الدقة في القياس ورصد البيانات (4 درجات)
- ممتاز (4): قراءة مستويات السوائل عند قاع التقعر بدقة، تدوين الوحدات في الجداول بشكل صحيح.
- جيد (2-3): دقة مقبولة في القياس مع خطأ طفيف في تسجيل المنازل العشرية.
- يحتاج تحسين (1): قراءات غير دقيقة أو إهمال تسجيل الوحدات.

المعيار الثالث: النظافة وإعادة الأجهزة إلى حالتها (3 درجات)
- ممتاز (3): غسل الزجاجيات وتجفيفها وفصل مصادر التيار الكهربائي وإعادة الكواشف لأماكنها.`,

    'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر': `شرح مبسط: كيف نولد الكهرباء من الحركة والمغناطيس؟

المفهوم الأساسي:
تخيل أن خطوط المجال المغناطيسي هي "أوتار غير مرئية". طالما أن المغناطيس ثابت داخل الملف، لا يحدث أي شيء. 
ولكن بمجرد أن تحرك المغناطيس للداخل أو للخارج، فإنك "تقطع" هذه الخطوط. هذا التغير المفاجئ في عدد الخطوط (التدفق المغناطيسي) يدفع الإلكترونات الحرة داخل السلك للحركة، مما يولد تياراً كهربائياً يُسمى "التيار التأثيري".

قانون فاراداي بلغة مبسطة:
مقدار الكهرباء المتولدة يعتمد على 3 عوامل:
1. سرعة حركة المغناطيس (كلما زادت السرعة زاد التيار).
2. قوة المغناطيس المستخدم.
3. عدد لفات الملف (كلما زادت اللفات زاد الجهد المتولد).

تطبيق واقعي يلامس حياة الطالب:
- دينامو الدراجة الهوائية.
- الشواحن اللاسلكية للهواتف الذكية.
- محطات توليد الطاقة الكهربائية العملاقة.`,

    'تجارب منزلية آمنة توضح تفاعلات الأكسدة والاختزال': `تجارب علمية منزلية آمنة: كيمياء الأكسدة والاختزال في المطبخ

1. تجربة: تلميع الفضيات المسودة برقائق الألومنيوم والملح
- الفكرة: كبريتيد الفضة (الطبقة السوداء) يختزل ويعود فضة لامعة، بينما يتأكسد الألومنيوم لأنه أنشط كيميائياً.
- المواد: وعاء زجاجي مبطن بورق ألومنيوم، ماء مغلي، ملعقة بيكربونات صوديوم أو ملح طعام، قطعة فضية باهتة.
- المشاهدة: اختفاء السواد فوراً وعودة اللمعان في ثوانٍ مع انبعاث رائحة طفيفة للكبريت.

2. تجربة: حماية شرائح التفاح من الأكسدة بفيتامين C
- الفكرة: إنزيم البوليفينول أوكسيديز يؤكسد المركبات في التفاح فتتحول للبني. يعمل فيتامين C (عصير الليمون) كمضاد أكسدة (يضحي بنفسه ويتأكسد أولاً).
- التطبيق: دهن نصف تفاحة بعصير الليمون وترك النصف الآخر مكشوفاً للمقارنة بعد 30 دقيقة.`
  };

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'مرحباً بك في المساعد الذكي لمنظومة NEXORA! كيف يمكنني مساعدتك اليوم في تحضير درس علوم، تصميم نشاط معملي، أو صياغة اختبار معياري؟'
    }
  ]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input.trim();
    if (!query) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setInput('');

    // Authentic AI response resolution
    setTimeout(() => {
      let reply = defaultResponses[query];
      if (!reply) {
        reply = `تمت معالجة استفسارك العلمي: "${query}".

التوصيات المنهجية المعتمدة:
1. ربط المفهوم بالكفايات الأساسية للعلوم وفق معايير 2026.
2. استخدام المحاكاة التفاعلية عبر منصة NEXORA LAB لتمثيل التجربة عملياً.
3. إشراك المتعلمين من خلال أسئلة التفكير الناقد وحل المشكلات.
4. إتاحة مساحة للتقويم التكويني الفوري للتأكد من رسوخ المفهوم العلمي.`;
      }
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    }, 450);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-[#0B3D5B] text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2E9E6F] text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA AI</span>
                <span className="text-white/40">·</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">معاينة تجريبية للمساعد</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold">المساعد الذكي لتعليم العلوم</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap shrink-0">نماذج جاهزة:</span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 hover:text-[#00A7B5] border border-slate-200 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#F8FAFC]">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-[#0B3D5B] text-white' 
                  : 'bg-[#2E9E6F] text-white shadow-2xs'
              }`}>
                {msg.role === 'user' ? 'أنت' : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0B3D5B] text-white rounded-tr-none'
                  : 'bg-white border border-slate-200 text-slate-800 shadow-2xs rounded-tl-none whitespace-pre-wrap'
              }`}>
                <div>{msg.content}</div>

                {msg.role === 'assistant' && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-slate-400">
                    <button
                      onClick={() => copyToClipboard(msg.content, index)}
                      className="hover:text-slate-700 p-1 rounded flex items-center gap-1 text-[11px] cursor-pointer"
                      title="نسخ المحتوى"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب استفسارك التربوي أو العلمي هنا (مثال: صمم اختبار كيمياء قصير)..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#00A7B5] focus:bg-white transition-all text-right"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-xl bg-[#00A7B5] hover:bg-[#008591] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shrink-0"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            يعمل المساعد حالياً بنماذج إرشادية تجريبية مسبقة الإعداد، وسيتم ربطه بنماذج الذكاء الاصطناعي التوليدي عبر الخادم في المرحلة القادمة.
          </p>
        </div>

      </div>
    </div>
  );
};
