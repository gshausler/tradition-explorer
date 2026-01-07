
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
export type Tradition = 
  | 'Fundamentalist Christianity' | 'Judaism' | 'Stoicism' | 'Mainstream Christianity'
  | 'Catholicism' | 'Islam' | 'Humanism' | 'Buddhism' | 'Taoism' | 'Hinduism';

export type SectionKey = 'summary' | 'comparison' | 'discussion' | 'deep dive' | 'quotes and references' | 'conclusion';

export interface TraditionContent {
  [tradition: string]: string;
}

export interface ComparisonResult {
  id: string;
  question: string;
  selectedTraditions: Tradition[];
  timestamp: number;
  data: {
    [key in SectionKey]: TraditionContent;
  };
}

// --- CONSTANTS ---
export const TRADITIONS: Tradition[] = [
  'Fundamentalist Christianity', 'Judaism', 'Stoicism', 'Mainstream Christianity',
  'Catholicism', 'Islam', 'Humanism', 'Buddhism', 'Taoism', 'Hinduism'
];

export const SECTION_LABELS: Record<string, string> = {
  'summary': 'Summary',
  'comparison': 'Comparison',
  'discussion': 'Discussion',
  'deep dive': 'Deep Dive',
  'quotes and references': 'Quotes and References',
  'conclusion': 'Conclusion'
};

export const EXAMPLE_QUERIES = [
  "The ethics of artificial intelligence and the potential for machine consciousness",
  "The justification of 'Just War' theory versus the philosophy of absolute pacifism",
  "Environmental stewardship: Humanity's role as a master vs. a guardian of nature",
  "Wealth distribution and the tension between individual property and social justice",
  "The nature of suffering: Is it a test, a cycle, or an inherent flaw of existence?",
  "Physician-assisted suicide and the ethical limits of personal autonomy over life",
  "Animal rights and the hierarchy of beings: Our moral obligations to non-human life",
  "The balance between individual liberty and communal responsibility in a pandemic",
  "Forgiveness and reconciliation: The path to healing after deep systemic trauma",
  "The nature of truth: Is objective morality possible or is all ethics relative?",
  "Capital punishment and the sanctity of life within a judicial framework",
  "Marriage and the structure of family: Tradition versus evolving social contracts"
];

export const DEFAULT_SYSTEM_PROMPT = `You are a world-class scholar of ethics, comparative religion, and philosophy. 
Your task is to answer a user's question by analyzing it through the lens of one or more traditions.
Provide your response strictly in JSON format. 
Each section ("summary", "comparison", "discussion", "deep dive", "quotes and references", "conclusion") 
must be an object where keys are the specific tradition names requested and values are the detailed text for that tradition in that section.

Be respectful, objective, and deeply scholarly. 
Use Markdown formatting within the strings for emphasis, bullet points, or structure.`;

// --- ICONS ---
const ChevronDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);
const ChevronUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m18 15-6-6-6 6"/></svg>
);
const Trash = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const Download = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.17a2 2 0 0 1 1-1.74l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

// --- GEMINI SERVICE ---
const generateComparison = async (
  question: string,
  traditions: Tradition[],
  systemPrompt: string
): Promise<ComparisonResult> => {
  // Always initialize right before use with the API key from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const traditionSchemaProperties = traditions.reduce((acc, trad) => {
    acc[trad] = { type: Type.STRING };
    return acc;
  }, {} as any);
  const sectionSchema = {
    type: Type.OBJECT,
    properties: traditionSchemaProperties,
    required: traditions,
  };
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the following scholarly question: "${question}" from the distinct perspectives of: ${traditions.join(', ')}. Provide a deep, structured comparison.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: sectionSchema,
            comparison: sectionSchema,
            discussion: sectionSchema,
            "deep dive": sectionSchema,
            "quotes and references": sectionSchema,
            conclusion: sectionSchema,
          },
          required: ["summary", "comparison", "discussion", "deep dive", "quotes and references", "conclusion"],
        },
      },
    });
    return {
      id: crypto.randomUUID(),
      question,
      selectedTraditions: traditions,
      timestamp: Date.now(),
      data: JSON.parse(response.text || "{}"),
    };
  } catch (err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
};

// --- COMPONENTS ---
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ 
  title, children, defaultOpen = true 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">{title}</h3>
        <span className="section-header-icon">
          {isOpen ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
        </span>
      </button>
      <div className={`collapsible-content overflow-hidden transition-all duration-300 ${isOpen ? 'max-height-none border-t border-slate-200' : 'max-h-0'}`}>
        <div className="p-4 bg-white">{children}</div>
      </div>
    </div>
  );
};

// --- APP ---
const App: React.FC = () => {
  const [history, setHistory] = useState<ComparisonResult[]>(() => {
    const saved = localStorage.getItem('comparison_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentResult, setCurrentResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<Tradition[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('comparison_history', JSON.stringify(history)); }, [history]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fix: Explicitly type uniqueQuestions as string[] to fix inferred 'unknown' error in filter callback.
  const uniqueQuestions: string[] = Array.from(new Set(history.map(h => h.question)));

  const handleToggleTradition = (tradition: Tradition) => {
    if (selectedTraditions.includes(tradition)) {
      setSelectedTraditions(selectedTraditions.filter(t => t !== tradition));
    } else if (selectedTraditions.length < 3) {
      setSelectedTraditions([...selectedTraditions, tradition]);
    }
  };

  const handleSelectExample = (example: string) => { setQuestion(example); setShowExamples(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    setIsLoading(true);
    setIsDropdownOpen(false);
    try {
      const result = await generateComparison(question, selectedTraditions, systemPrompt);
      setCurrentResult(result);
      setHistory(prev => [result, ...prev]);
    } catch (error) { alert("An error occurred during generation. Please check your API key."); } finally { setIsLoading(false); }
  };

  const handleReport = async () => {
    if (!resultsRef.current || !currentResult) return;
    const element = resultsRef.current;
    const fileName = `Glenns_Tradition_Explorer_${currentResult.question.substring(0, 30).trim().replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    document.body.classList.add('pdf-export');
    try {
      // @ts-ignore
      await html2pdf().set({
        margin: [0.4, 0.4, 0.4, 0.4], filename: fileName, image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0, windowWidth: 1024 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }, pagebreak: { mode: ['css', 'legacy'] }
      }).from(element).save();
    } catch (error) { window.print(); } finally { setTimeout(() => document.body.classList.remove('pdf-export'), 1000); }
  };

  const loadFromHistory = (result: ComparisonResult) => { setCurrentResult(result); setQuestion(result.question); setSelectedTraditions(result.selectedTraditions); setShowHistory(false); setIsDropdownOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><HistoryIcon className="w-6 h-6" /></div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Glenn's Tradition Explorer</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowSystemPrompt(!showSystemPrompt)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all" title="System Settings"><SettingsIcon /></button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"><HistoryIcon className="w-4 h-4" /><span>History</span></button>
            {currentResult && <button onClick={handleReport} className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"><Download className="w-4 h-4" /><span>Report</span></button>}
          </div>
        </div>
      </header>
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 no-print">
          <div className="mb-6 relative" ref={dropdownRef}>
            <label htmlFor="question" className="block text-sm font-semibold text-slate-700 mb-2">What would you like to explore?</label>
            <div className="relative">
              <input id="question" type="text" className="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-all outline-none" placeholder='e.g., "The nature of mercy"' value={question} onFocus={() => uniqueQuestions.length > 0 && setIsDropdownOpen(true)} onChange={(e) => setQuestion(e.target.value)} />
              {uniqueQuestions.length > 0 && <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"><ChevronDown className={`transform transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} /></button>}
            </div>
            {isDropdownOpen && uniqueQuestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-slate-100 bg-slate-50"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Recent Queries</span></div>
                {uniqueQuestions.filter((q: string) => q.toLowerCase().includes(question.toLowerCase())).map((q, idx) => (
                  <button key={idx} onClick={() => { setQuestion(q); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center space-x-2"><HistoryIcon className="w-3.5 h-3.5 opacity-40 shrink-0" /><span className="truncate">{q}</span></button>
                ))}
              </div>
            )}
          </div>
          <div className="mb-6">
            <button onClick={() => setShowExamples(!showExamples)} className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg">
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mr-1">NEW</span><span>Inspiration? View scholarly examples</span><ChevronDown className={`w-4 h-4 transform transition-transform ${showExamples ? 'rotate-180' : ''}`} />
            </button>
            <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-hidden transition-all duration-300 ${showExamples ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {EXAMPLE_QUERIES.map((example, idx) => (<button key={idx} onClick={() => handleSelectExample(example)} className="text-left p-3 text-xs bg-slate-50 border border-slate-100 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-slate-600 leading-snug shadow-sm">{example}</button>))}
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select 1 to 3 traditions:</label>
            <div className="flex flex-wrap gap-2">
              {TRADITIONS.map((tradition) => (
                <button key={tradition} onClick={() => handleToggleTradition(tradition)} disabled={!selectedTraditions.includes(tradition) && selectedTraditions.length >= 3} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedTraditions.includes(tradition) ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50'}`}>{tradition}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button onClick={handleGenerate} disabled={isLoading || !question || selectedTraditions.length === 0} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 flex items-center space-x-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Consulting Wisdom...</span>
                </>
              ) : <span>Generate Analysis</span>}
            </button>
          </div>
        </div>
        <div id="results-display" ref={resultsRef} className="space-y-6 bg-white p-0">
          {currentResult ? (
            <div>
              <div className="hidden print-only pdf-show pdf-title-block mb-8 border-b-2 border-slate-900 pb-4">
                <h1 className="text-3xl font-bold serif text-slate-900 leading-tight">{currentResult.question}</h1>
                <div className="flex items-center space-x-4 text-sm text-slate-600 italic mt-4"><span>Traditions: {currentResult.selectedTraditions.join(', ')}</span><span>{new Date(currentResult.timestamp).toLocaleDateString()}</span></div>
              </div>
              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <CollapsibleSection key={`${currentResult.id}-${key}`} title={SECTION_LABELS[key]} defaultOpen={key === 'summary'}>
                  <div className={`grid grid-cols-1 ${currentResult.selectedTraditions.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-6`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className="flex flex-col h-full bg-slate-50/50 rounded-lg p-4 border border-slate-100">
                        <h4 className="font-bold text-indigo-900 border-b border-indigo-100 pb-2 mb-3 text-sm tracking-wider uppercase">{tradition}</h4>
                        <div className="prose prose-sm text-slate-700 leading-relaxed whitespace-pre-wrap text-left">{currentResult.data[key][tradition] || "N/A"}</div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          ) : !isLoading && <div className="text-center py-20 border-2 border-dashed border-slate-200 no-print"><h3 className="text-xl font-medium text-slate-900">Begin Exploration</h3></div>}
        </div>
      </main>
      {showSystemPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">System Instruction</h2><button onClick={() => setShowSystemPrompt(false)}>✕</button></div>
            <textarea className="w-full h-64 p-4 text-sm font-mono border border-slate-300 rounded-lg outline-none" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            <div className="mt-4 flex justify-end space-x-2"><button onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)} className="px-4 py-2 text-sm text-slate-600">Reset</button><button onClick={() => setShowSystemPrompt(false)} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg">Save</button></div>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="fixed inset-0 z-[70] no-print" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center"><h2>Query History</h2><button onClick={() => setShowHistory(false)}>✕</button></div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {history.map((item) => (<button key={item.id} onClick={() => loadFromHistory(item)} className="w-full text-left p-4 rounded-xl border hover:border-indigo-400"><strong>{item.question}</strong></button>))}
            </div>
          </div>
        </div>
      )}
      <footer className="bg-slate-50 border-t border-slate-200 py-8 no-print text-center text-slate-400 text-xs">© {new Date().getFullYear()} Glenn's Tradition Explorer.</footer>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
