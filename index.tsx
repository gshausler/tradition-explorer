import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
type Tradition = 
  | 'Fundamentalist Christianity' | 'Judaism' | 'Stoicism' | 'Mainstream Christianity'
  | 'Catholicism' | 'Islam' | 'Humanism' | 'Buddhism' | 'Taoism' | 'Hinduism';

type SectionKey = 'summary' | 'comparison' | 'discussion' | 'deep dive' | 'quotes and references' | 'conclusion';

interface TraditionContent {
  [tradition: string]: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ComparisonResult {
  id: string;
  question: string;
  selectedTraditions: Tradition[];
  timestamp: number;
  data: {
    [key in SectionKey]: TraditionContent;
  };
  chatHistory?: ChatMessage[];
}

// --- CONSTANTS ---
const TRADITIONS: Tradition[] = [
  'Fundamentalist Christianity', 'Judaism', 'Stoicism', 'Mainstream Christianity',
  'Catholicism', 'Islam', 'Humanism', 'Buddhism', 'Taoism', 'Hinduism'
];

const SECTION_LABELS: Record<string, string> = {
  'summary': 'Executive Summary',
  'comparison': 'Thematic Comparison',
  'discussion': 'Nuanced Discussion',
  'deep dive': 'Educational Deep Dive',
  'quotes and references': 'Glossary & Resources',
  'conclusion': 'Final Synthesis'
};

const DEFAULT_SYSTEM_PROMPT = `You are a supportive pedagogical mentor and world-class scholar.
Explain complex ideas simply for beginners. 

CRITICAL INSTRUCTIONS:
1. PEDAGOGY: Define specialized terminology (e.g., 'Agape', 'Karma') upon first use.
2. GLOSSARY: In the 'quotes and references' section, provide a "Technical Glossary" with '### Term Name' headers.
3. CROSS-REFERENCE: Use [Term Name](#term-name) links throughout your analysis to jump to glossary headers. 
   - IMPORTANT: The anchor must be the lowercase-kebab-case version of the name (e.g., #categorical-imperative for "### Categorical Imperative").
4. EXTERNAL LINKS: Provide full https:// URLs for high-quality scholarly sources.
5. FORMAT: Respond strictly in JSON. Ensure headers in 'quotes and references' match your links exactly.`;

// --- ICONS ---
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.17a2 2 0 0 1 1-1.74l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const MessageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const ChevronDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);
const ChevronUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m18 15-6-6-6 6"/></svg>
);

declare var html2pdf: any;

// --- MARKDOWN RENDERER ---
const CustomMarkdown: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => {
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (href?.startsWith('#')) {
      e.preventDefault();
      const id = href.slice(1);
      const element = document.getElementById(id);
      if (element) {
        const headerOffset = 100; 
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className={`prose prose-sm max-w-none prose-headings:serif prose-headings:text-slate-900 ${isUser ? 'prose-invert' : 'prose-slate text-slate-800'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ node, ...props }) => {
            const isExternal = props.href?.startsWith('http');
            return (
              <a
                {...props}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="hover:underline text-indigo-600 font-bold cursor-pointer transition-colors"
                onClick={handleAnchorClick}
              >
                {props.children}
                {isExternal && <span className="inline-block ml-1 opacity-70 text-[10px]">↗</span>}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// --- GEMINI SERVICE ---
const generateComparison = async (
  question: string,
  traditions: Tradition[],
  systemPrompt: string
): Promise<ComparisonResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const traditionSchemaProperties = traditions.reduce((acc, trad) => {
    acc[trad] = { type: Type.STRING };
    return acc;
  }, {} as any);
  const sectionSchema = { type: Type.OBJECT, properties: traditionSchemaProperties, required: traditions };
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze: "${question}" from these specific perspectives: ${traditions.join(', ')}. Ensure the Glossary section has ID-compatible headers.`,
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
      chatHistory: []
    };
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw new Error(err.message || "Analytical server error.");
  }
};

const sendChatMessage = async (
  message: string,
  history: ChatMessage[],
  context: ComparisonResult
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contextSummary = `Mentor role. Context: "${context.question}". Data: ${JSON.stringify(context.data).substring(0, 2000)}`;
  const chat = ai.chats.create({ model: 'gemini-3-pro-preview', config: { systemInstruction: contextSummary } });
  const response = await chat.sendMessage({ message });
  return response.text || "Dialogue connection failed.";
};

// --- UI COMPONENTS ---
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ 
  title, children, defaultOpen = true 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-3xl bg-white overflow-hidden shadow-sm mb-8 transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3>
        {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
      </button>
      <div className={`transition-all duration-300 ${isOpen ? 'max-h-none border-t border-slate-100 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-8 bg-white">{children}</div>
      </div>
    </div>
  );
};

const DiscussionSidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  result: ComparisonResult;
  onUpdateHistory: (newHistory: ChatMessage[]) => void;
}> = ({ isOpen, onClose, result, onUpdateHistory }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(result.chatHistory || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    try {
      const response = await sendChatMessage(input, messages, result);
      const finalMessages: ChatMessage[] = [...newMessages, { role: 'model', text: response }];
      setMessages(finalMessages);
      onUpdateHistory(finalMessages);
    } catch { setMessages([...newMessages, { role: 'model', text: "Scholar is momentarily unavailable." }]); }
    finally { setIsLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] no-print">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col">
        <div className="p-6 border-b flex items-center justify-between bg-indigo-600 text-white shadow-lg">
          <div>
            <h2 className="text-lg font-bold flex items-center"><MessageIcon className="mr-2" />Scholar Dialogue</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Mentorship Protocol</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl font-light">✕</button>
        </div>
        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-3xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                <CustomMarkdown content={msg.text} isUser={msg.role === 'user'} />
              </div>
            </div>
          ))}
          {isLoading && <div className="text-[10px] font-black uppercase text-indigo-600 animate-pulse px-4">The Scholar is contemplating...</div>}
        </div>
        <div className="p-6 border-t bg-white">
          <div className="flex space-x-3">
            <textarea 
              rows={2} 
              className="flex-grow p-5 text-sm border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 text-slate-900 bg-white transition-all resize-none shadow-inner" 
              placeholder="Ask for a deep dive..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="px-6 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [history, setHistory] = useState<ComparisonResult[]>(() => {
    const saved = localStorage.getItem('tradition_explorer_history_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentResult, setCurrentResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<Tradition[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('tradition_explorer_history_v2', JSON.stringify(history)); }, [history]);
  
  useEffect(() => {
    const clickOut = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false); };
    document.addEventListener('mousedown', clickOut);
    return () => document.removeEventListener('mousedown', clickOut);
  }, []);

  const uniqueQuestions: string[] = Array.from(new Set(history.map(h => h.question)));

  const handleToggleTradition = (t: Tradition) => {
    if (selectedTraditions.includes(t)) setSelectedTraditions(selectedTraditions.filter(x => x !== t));
    else if (selectedTraditions.length < 3) setSelectedTraditions([...selectedTraditions, t]);
  };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    setIsLoading(true);
    try {
      const res = await generateComparison(question, selectedTraditions, systemPrompt);
      setCurrentResult(res);
      setHistory(prev => [res, ...prev]);
      setIsDropdownOpen(false);
    } catch (e: any) { alert(e.message || "Scholar connection lost."); }
    finally { setIsLoading(false); }
  };

  const handleExportPDF = async () => {
    if (!currentResult || !resultsRef.current || isExporting) return;
    setIsExporting(true);
    
    // Preparation for html2pdf
    document.body.classList.add('pdf-export');
    
    const element = resultsRef.current;
    const fileName = `Analysis_${currentResult.question.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    
    const opt = {
      margin: [0.5, 0.5],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(element).save();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("PDF Fail:", err);
      window.print();
    } finally {
      document.body.classList.remove('pdf-export');
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur-lg border-b sticky top-0 z-[60] no-print h-16 flex items-center justify-between px-8 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-200"><HistoryIcon className="w-5 h-5" /></div>
          <h1 className="text-xl font-black tracking-tight serif">Tradition Explorer</h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => setShowSystemPrompt(true)} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Settings"><SettingsIcon /></button>
          <button onClick={() => setShowHistory(true)} className="px-5 py-2.5 text-xs font-black uppercase tracking-widest border-2 border-slate-100 rounded-2xl hover:bg-white hover:border-indigo-100 transition-all">Archives</button>
          {currentResult && (
            <button 
              onClick={handleExportPDF} 
              disabled={isExporting}
              className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center"
            >
              {isExporting ? "Rendering..." : "Export PDF"}
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 py-10">
        <div className="bg-white rounded-[3rem] shadow-2xl p-12 mb-12 no-print border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
          
          <div className="mb-10 relative" ref={dropdownRef}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Core Research Topic</label>
            <div className="relative group">
              <input 
                type="text" 
                className="w-full pl-8 pr-16 py-7 rounded-[2rem] border-2 border-slate-50 bg-slate-50 text-slate-900 font-bold text-xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner placeholder:text-slate-300"
                placeholder='Enter philosophical or ethical inquiry...' 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                onFocus={() => uniqueQuestions.length > 0 && setIsDropdownOpen(true)} 
              />
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors">
                <ChevronDown className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-4 bg-white border border-slate-100 rounded-[2rem] shadow-2xl max-h-72 overflow-y-auto p-4 animate-in fade-in slide-in-from-top-2">
                {uniqueQuestions.filter(q => q.toLowerCase().includes(question.toLowerCase())).map((q, i) => (
                  <button key={i} onClick={() => { setQuestion(q); setIsDropdownOpen(false); }} className="w-full text-left px-6 py-5 hover:bg-indigo-50 rounded-2xl border-b border-slate-50 last:border-0 truncate font-bold text-slate-700 transition-colors">{q}</button>
                ))}
              </div>
            )}
          </div>
          
          <div className="mb-12">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Comparative Traditions (Max 3)</label>
            <div className="flex flex-wrap gap-3">
              {TRADITIONS.map(t => (
                <button key={t} onClick={() => handleToggleTradition(t)} disabled={!selectedTraditions.includes(t) && selectedTraditions.length >= 3} className={`px-7 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedTraditions.includes(t) ? 'bg-indigo-600 text-white scale-105 shadow-xl shadow-indigo-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30'}`}>{t}</button>
              ))}
            </div>
          </div>
          
          <button onClick={handleGenerate} disabled={isLoading || !question || selectedTraditions.length === 0} className="w-full py-8 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-[2rem] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50">
            {isLoading ? "Consulting Scholarship..." : "Synthesize Multi-Perspective Analysis"}
          </button>
        </div>

        <div ref={resultsRef} className="space-y-12">
          {currentResult ? (
            <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="pdf-show mb-12 border-b-[12px] border-slate-900 pb-10">
                <h1 className="text-6xl font-black serif leading-tight mb-4">{currentResult.question}</h1>
                <div className="flex items-center space-x-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                  <span>Scholarly Archive</span>
                  <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                  <span>{new Date(currentResult.timestamp).toLocaleDateString()}</span>
                  <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                  <span>{currentResult.selectedTraditions.join(' • ')}</span>
                </div>
              </div>

              <div className="fixed bottom-12 right-12 z-[70] no-print">
                 <button onClick={() => setShowDiscussion(true)} className="group flex items-center bg-indigo-600 text-white px-8 py-5 rounded-full shadow-2xl hover:bg-indigo-700 transition-all scale-110 hover:scale-125 active:scale-100 shadow-indigo-200">
                    <MessageIcon className="mr-3 w-6 h-6" />
                    <span className="font-black uppercase tracking-widest text-xs">Scholar Dialogue</span>
                 </button>
              </div>

              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <CollapsibleSection key={key} title={SECTION_LABELS[key]}>
                  <div className={`grid grid-cols-1 ${currentResult.selectedTraditions.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-10`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className={`flex flex-col p-10 border-2 rounded-[2.5rem] pdf-card ${key === 'deep dive' ? 'bg-indigo-50/20 border-indigo-100/50' : 'bg-white border-slate-50 shadow-sm'}`}>
                        <h4 className="font-black text-indigo-600 text-[10px] mb-8 uppercase tracking-[0.3em] flex items-center">
                          <span className="w-3 h-3 bg-indigo-600 rounded-full mr-3 shadow-lg shadow-indigo-100"></span>
                          {tradition}
                        </h4>
                        <CustomMarkdown content={currentResult.data[key][tradition] || "Awaiting archival data..."} />
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          ) : !isLoading && (
            <div className="text-center py-48 border-[6px] border-dashed border-slate-100 rounded-[4rem] opacity-40 transition-all hover:opacity-60 bg-white/30">
              <div className="serif text-4xl italic text-slate-300 mb-6">"Sapere Aude"</div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Dare to Know</p>
            </div>
          )}
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-[110] no-print" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col p-10 animate-in slide-in-from-right duration-500" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black serif">Archives</h2>
              <button onClick={() => setShowHistory(false)} className="p-3 hover:bg-slate-50 rounded-full transition-all text-2xl font-light">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-6">
              {history.map(item => (
                <button key={item.id} onClick={() => { setCurrentResult(item); setShowHistory(false); setQuestion(item.question); setSelectedTraditions(item.selectedTraditions); }} className="w-full text-left p-8 border-2 border-slate-50 rounded-[2rem] hover:bg-indigo-50 hover:border-indigo-100 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                  <p className="font-bold text-slate-900 line-clamp-2 leading-relaxed mb-3">{item.question}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                </button>
              ))}
              {history.length === 0 && <p className="text-center text-slate-300 italic py-20">The archives are currently silent.</p>}
            </div>
            <button onClick={() => { if(confirm("Purge all archives?")) {setHistory([]); setCurrentResult(null);} }} className="mt-10 py-5 bg-red-50 text-red-500 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-red-100 transition-colors">Purge Records</button>
          </div>
        </div>
      )}

      {showSystemPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md no-print">
          <div className="bg-white rounded-[3rem] max-w-4xl w-full p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black serif mb-2">Scholar Protocol</h2>
            <p className="text-[10px] text-slate-400 mb-8 font-black uppercase tracking-[0.3em]">Cognitive Framework Settings</p>
            <textarea className="w-full h-96 p-8 border-2 border-slate-50 rounded-[2rem] font-mono text-xs mb-10 bg-slate-50 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            <div className="flex justify-end space-x-6">
              <button onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)} className="text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-indigo-600 transition-colors">Restore Defaults</button>
              <button onClick={() => setShowSystemPrompt(false)} className="px-12 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Save Protocol</button>
            </div>
          </div>
        </div>
      )}

      {showDiscussion && currentResult && (
        <DiscussionSidebar 
          isOpen={showDiscussion} 
          onClose={() => setShowDiscussion(false)} 
          result={currentResult} 
          onUpdateHistory={(h) => setHistory(history.map(x => x.id === currentResult.id ? {...x, chatHistory: h} : x))} 
        />
      )}
      
      <footer className="bg-white border-t py-20 text-center no-print">
        <div className="serif text-2xl italic text-slate-200 mb-4">Veritas et Sapientia</div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Tradition Explorer • Intellectual Synthesis Engine</p>
      </footer>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);