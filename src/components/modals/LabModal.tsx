import React, { useState } from 'react';
import { X, Play, RotateCcw, Droplet, Sparkles, Activity, CheckCircle, Info, Beaker, Zap } from 'lucide-react';

interface LabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LabModal: React.FC<LabModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeExp, setActiveExp] = useState<'titration' | 'ohms'>('titration');

  // Titration state
  const [naohAdded, setNaohAdded] = useState<number>(0); // in mL
  const [stirring, setStirring] = useState<boolean>(true);
  const equivalencePoint = 22.5; // mL of 0.1M NaOH to neutralize 25mL 0.09M HCl

  // Ohm's law state
  const [voltage, setVoltage] = useState<number>(6); // Volts
  const [resistance, setResistance] = useState<number>(20); // Ohms
  const current = parseFloat((voltage / resistance).toFixed(3)); // Amperes

  // Titration pH calculation helper
  const calculatePH = (added: number) => {
    if (added === 0) return 1.05;
    if (added < equivalencePoint) {
      const remainingAcidFraction = (equivalencePoint - added) / equivalencePoint;
      const ph = 1.05 - Math.log10(remainingAcidFraction);
      return Math.min(6.5, parseFloat(ph.toFixed(2)));
    } else if (Math.abs(added - equivalencePoint) < 0.2) {
      return 7.0;
    } else {
      const excessBaseFraction = (added - equivalencePoint) / 25;
      const poh = 1.0 - Math.log10(Math.max(0.001, excessBaseFraction));
      const ph = 14 - Math.max(1, Math.min(13, poh));
      return Math.min(12.8, parseFloat(ph.toFixed(2)));
    }
  };

  const currentPH = calculatePH(naohAdded);
  const isPink = naohAdded >= equivalencePoint - 0.2;
  const pinkIntensity = isPink 
    ? Math.min(0.85, 0.25 + (naohAdded - (equivalencePoint - 0.2)) * 0.12) 
    : 0;

  const addDrop = () => {
    setNaohAdded(prev => Math.min(45, parseFloat((prev + 0.5).toFixed(1))));
  };

  const addFast = () => {
    setNaohAdded(prev => Math.min(45, parseFloat((prev + 2.5).toFixed(1))));
  };

  const resetTitration = () => {
    setNaohAdded(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Lab Top Bar */}
        <div className="bg-[#0B3D5B] text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00A7B5] flex items-center justify-center text-white shadow-xs">
              <Beaker className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-latin text-xs font-bold text-[#00A7B5] tracking-wider">NEXORA LAB</span>
                <span className="text-white/40">|</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded">محاكاة تفاعلية حية</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold">المختبر الافتراضي الذكي للعلوم</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Experiment Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-white/10 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveExp('titration')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeExp === 'titration' ? 'bg-[#00A7B5] text-white' : 'text-slate-300 hover:text-white'}`}
              >
                المعايرة الكيميائية
              </button>
              <button
                onClick={() => setActiveExp('ohms')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeExp === 'ohms' ? 'bg-[#00A7B5] text-white' : 'text-slate-300 hover:text-white'}`}
              >
                قانون أوم الكهربائي
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="إغلاق المختبر"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Experiment Tab Buttons on Mobile */}
        <div className="sm:hidden flex border-b border-slate-200 bg-slate-100 text-xs font-bold">
          <button
            onClick={() => setActiveExp('titration')}
            className={`flex-1 py-2.5 text-center ${activeExp === 'titration' ? 'bg-white text-[#0B3D5B] border-b-2 border-[#00A7B5]' : 'text-slate-600'}`}
          >
            المعايرة الكيميائية
          </button>
          <button
            onClick={() => setActiveExp('ohms')}
            className={`flex-1 py-2.5 text-center ${activeExp === 'ohms' ? 'bg-white text-[#0B3D5B] border-b-2 border-[#00A7B5]' : 'text-slate-600'}`}
          >
            قانون أوم الكهربائي
          </button>
        </div>

        {/* Lab Workspace Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F8FAFC]">
          {activeExp === 'titration' ? (
            /* ================= TITRATION EXPERIMENT ================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Interactive Apparatus Canvas (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center">
                
                {/* Apparatus Header */}
                <div className="w-full flex items-center justify-between text-xs mb-3 pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800">حامل المعايرة والسحاحة الرقمية</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">حجم NaOH المضاف:</span>
                    <strong className="font-mono text-sm text-[#00A7B5]">{naohAdded.toFixed(1)} mL</strong>
                  </div>
                </div>

                {/* Simulated Glassware SVG Visual */}
                <div className="relative w-64 h-72 flex flex-col items-center justify-center py-2">
                  
                  {/* Burette Tube */}
                  <div className="relative w-7 h-36 bg-cyan-50/70 border-2 border-slate-300 rounded-t-sm flex flex-col justify-end overflow-hidden shadow-inner">
                    <div 
                      className="w-full bg-[#00A7B5]/40 border-t border-[#00A7B5] transition-all duration-300"
                      style={{ height: `${Math.max(5, 100 - (naohAdded / 50) * 100)}%` }}
                    />
                    {/* Scale tick marks */}
                    <div className="absolute inset-0 flex flex-col justify-between py-1 px-0.5 opacity-60 pointer-events-none">
                      {[0, 10, 20, 30, 40, 50].map((t) => (
                        <div key={t} className="w-2 border-t border-slate-600 self-end" />
                      ))}
                    </div>
                  </div>

                  {/* Stopcock valve */}
                  <div className="w-12 h-3.5 bg-slate-700 rounded-sm my-0.5 relative flex items-center justify-center">
                    <div className="w-2 h-5 bg-[#D4AF37] rounded-xs" />
                  </div>

                  {/* Burette Tip with droplet animation when added */}
                  <div className="w-1.5 h-4 bg-slate-300 relative flex justify-center">
                    {naohAdded > 0 && (
                      <div className="w-2 h-2 rounded-full bg-[#00A7B5] animate-ping absolute -bottom-1" />
                    )}
                  </div>

                  {/* Erlenmeyer Flask */}
                  <div className="relative w-32 h-24 mt-1 flex flex-col items-center justify-end">
                    <div 
                      className="w-full h-18 border-2 border-slate-300 rounded-b-3xl rounded-t-lg transition-colors duration-500 overflow-hidden relative shadow-inner"
                      style={{
                        backgroundColor: isPink ? `rgba(244, 114, 182, ${pinkIntensity})` : 'rgba(238, 242, 246, 0.7)'
                      }}
                    >
                      {/* Liquid level */}
                      <div className="absolute bottom-1 right-2 left-2 flex justify-between text-[10px] text-slate-500 pointer-events-none">
                        <span>25 mL HCl</span>
                        <span>{stirring ? 'تقليب نشط' : ''}</span>
                      </div>
                      {/* Magnetic Stirrer Bar */}
                      <div className={`w-8 h-2 bg-white border border-slate-400 rounded-full mx-auto mt-9 shadow-xs ${stirring ? 'animate-spin' : ''}`} />
                    </div>
                  </div>

                </div>

                {/* Live Real-time pH & Color Indicator */}
                <div className="w-full mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">الرقم الهيدروجيني:</span>
                    <span className={`px-2.5 py-1 rounded-md font-mono font-bold text-sm ${
                      currentPH >= 7.5 ? 'bg-pink-100 text-pink-700' : currentPH >= 6.5 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                    }`}>
                      pH {currentPH}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">حالة الكاشف:</span>
                    <strong className={isPink ? 'text-pink-600 font-bold' : 'text-slate-600 font-medium'}>
                      {isPink ? 'وردي فاتح (نقطة التكافؤ)' : 'عديم اللون (وسط حمضي)'}
                    </strong>
                  </div>
                </div>

              </div>

              {/* Controls & Concept Deck (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Dispensing Controls */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-800 mb-3">التحكم في إضافة القاعدة (NaOH 0.1M):</h4>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={addDrop}
                      className="py-2.5 px-3 rounded-lg text-xs font-bold text-white bg-[#00A7B5] hover:bg-[#008591] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Droplet className="w-3.5 h-3.5" />
                      <span>إضافة قطرة (+0.5 mL)</span>
                    </button>

                    <button
                      onClick={addFast}
                      className="py-2.5 px-3 rounded-lg text-xs font-bold text-[#0B3D5B] bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>إضافة سريعة (+2.5 mL)</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setStirring(!stirring)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        stirring ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {stirring ? 'إيقاف المحرك' : 'تشغيل محرك التقليب'}
                    </button>

                    <button
                      onClick={resetTitration}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="إعادة ضبط التجربة"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة التجربة</span>
                    </button>
                  </div>
                </div>

                {/* Calculations & Educational Note */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs text-xs space-y-2.5 text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-[#0B3D5B]">
                    <Info className="w-4 h-4 text-[#00A7B5]" />
                    <span>المعادلة والحسابات الكيميائية:</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg font-latin text-center font-mono text-xs text-slate-800" dir="ltr">
                    HCl + NaOH → NaCl + H₂O
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    عند نقطة التكافؤ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">M₁ × V₁ = M₂ × V₂</code>
                    <br />
                    حجم التعادل النظري المتوقع هو <strong className="text-slate-900">22.5 mL</strong>.
                  </p>
                  {isPink && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>أحسنت! وصلت لنقطة التكافؤ وثبت اللون الوردي الفاتح للكاشف.</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            /* ================= OHM'S LAW EXPERIMENT ================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Circuit Schematic & Live Meters (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-xs mb-3 pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800">الدائرة الكهربائية وقراءات العدادات</span>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>التيار المستمر DC</span>
                  </div>
                </div>

                {/* Circuit SVG Graphic */}
                <div className="relative w-full max-w-md h-52 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between items-center my-2">
                  <svg viewBox="0 0 400 160" className="w-full h-full">
                    {/* Wires */}
                    <rect x="50" y="30" width="300" height="100" fill="none" stroke="#64748b" strokeWidth="3" rx="10" />
                    {/* DC Power Supply */}
                    <rect x="35" y="65" width="30" height="30" fill="#0B3D5B" rx="4" />
                    <text x="50" y="85" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">{voltage}V</text>
                    {/* Resistor Component */}
                    <rect x="170" y="20" width="60" height="20" fill="#D4AF37" rx="3" stroke="#b89324" />
                    <text x="200" y="34" fill="#0B3D5B" fontSize="11" fontWeight="bold" textAnchor="middle">{resistance}Ω</text>
                    {/* Ammeter */}
                    <circle cx="200" cy="130" r="16" fill="#00A7B5" stroke="#0B3D5B" strokeWidth="2" />
                    <text x="200" y="135" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">A</text>
                  </svg>
                </div>

                {/* Digital Meters Readout */}
                <div className="w-full grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[11px] text-slate-500 block">فرق الجهد (V)</span>
                    <strong className="text-base font-bold text-amber-800 font-mono">{voltage} V</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">المقاومة (R)</span>
                    <strong className="text-base font-bold text-slate-800 font-mono">{resistance} Ω</strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block">شدة التيار (I)</span>
                    <strong className="text-base font-bold text-emerald-800 font-mono">{current} A</strong>
                  </div>
                </div>

              </div>

              {/* Sliders and Theory (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Parameter Sliders */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h4 className="text-xs font-bold text-slate-800">التحكم في متغيرات الدائرة:</h4>
                  
                  {/* Voltage Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">جهد المصدر (Voltage):</span>
                      <strong className="font-mono text-[#0B3D5B]">{voltage} Volts</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="24"
                      step="1"
                      value={voltage}
                      onChange={(e) => setVoltage(Number(e.target.value))}
                      className="w-full accent-[#00A7B5] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>1V</span>
                      <span>12V</span>
                      <span>24V</span>
                    </div>
                  </div>

                  {/* Resistance Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">قيمة المقاومة (Resistance):</span>
                      <strong className="font-mono text-[#0B3D5B]">{resistance} Ohms</strong>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={resistance}
                      onChange={(e) => setResistance(Number(e.target.value))}
                      className="w-full accent-[#2E9E6F] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>5Ω</span>
                      <span>50Ω</span>
                      <span>100Ω</span>
                    </div>
                  </div>
                </div>

                {/* Ohm's Law Explanation */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs text-xs space-y-2.5 text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-[#0B3D5B]">
                    <Activity className="w-4 h-4 text-[#00A7B5]" />
                    <span>قانون أوم الرياضي:</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg font-latin text-center font-mono text-sm text-[#0B3D5B]" dir="ltr">
                    I = V / R = {voltage} / {resistance} = {current} A
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    يتناسب التيار الكهربائي <strong className="text-slate-900">طردياً</strong> مع فرق الجهد المطبق، و<strong className="text-slate-900">عكسياً</strong> مع مقاومة الموصل عند ثبوت درجة الحرارة.
                  </p>
                </div>

              </div>

            </div>
          )}
        </div>

        {/* Lab Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            تجارب محاكاة تفاعلية مصممة لدعم المناهج والموضوعات العلمية الحديثة
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            إغلاق المختبر
          </button>
        </div>

      </div>
    </div>
  );
};
