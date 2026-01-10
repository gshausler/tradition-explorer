import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & CONSTANTS ---
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

const DEFAULT_SYSTEM_PROMPT = `You are a world-class scholarly mentor. Respond ONLY in valid JSON.
Analyze the provided question from the perspective of each selected tradition.
Sections to provide: summary, comparison, discussion, deep dive, quotes and references, conclusion.
Format: { "section_name": { "Tradition Name": "Markdown content..." } }`;

// --- ICONS ---
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
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
const KeyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3L15.5 7.5z"/></svg>
);

declare var html2pdf: any;
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- HELPERS ---
const CustomMarkdown: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => (
  <div className={`prose prose-sm max-w-none prose-headings:serif prose-headings:text-slate-900 ${isUser ? 'prose-invert' : 'prose-slate text-slate-800'}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
      {content}
    </ReactMarkdown>
  </div>
);

// --- MAIN APP ---
const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [history, setHistory] = useState<ComparisonResult[]>(() => {
    const saved = localStorage.getItem('tradition_explorer_history_final');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentResult, setCurrentResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<Tradition[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [dialogueInput, setDialogueInput] = useState('');
  const [isDialogueLoading, setIsDialogueLoading] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window.aistudio !== 'undefined') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected || !!process.env.API_KEY);
      } else {
        setHasKey(!!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem('tradition_explorer_history_final', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentResult?.chatHistory, isDialogueLoading]);

  const handleSelectKey = async () => {
    if (typeof window.aistudio !== 'undefined') {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    setIsLoading(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const traditionSchemaProperties = selectedTraditions.reduce((acc, trad) => {
      acc[trad] = { type: Type.STRING };
      return acc;
    }, {} as any);
    const sectionSchema = { type: Type.OBJECT, properties: traditionSchemaProperties, required: selectedTraditions };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Detailed analysis of: "${question}" from: ${selectedTraditions.join(', ')}.`,
        config: {
          systemInstruction: DEFAULT_SYSTEM_PROMPT,
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

      const res: ComparisonResult = {
        id: crypto.randomUUID(),
        question,
        selectedTraditions,
        timestamp: Date.now(),
        data: JSON.parse(response.text || "{}"),
        chatHistory: []
      };
      
      setCurrentResult(res);
      setHistory(prev => [res, ...prev]);
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
      } else {
        alert("Scholarship service error. Try simplifying your query or reducing tradition count.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDialogue = async () => {
    if (!dialogueInput.trim() || isDialogueLoading || !currentResult) return;
    const input = dialogueInput;
    setDialogueInput('');
    setIsDialogueLoading(true);

    const userMsg: ChatMessage = { role: 'user', text: input };
    const updatedHistory = [...(currentResult.chatHistory || []), userMsg];
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = `Context: "${currentResult.question}". Focus: ${currentResult.selectedTraditions.join(', ')}. Data: ${JSON.stringify(currentResult.data).substring(0, 500)}`;
    const chat = ai.chats.create({ model: 'gemini-3-pro-preview', config: { systemInstruction: context } });

    try {
      const response = await chat.sendMessage({ message: input });
      const modelMsg: ChatMessage = { role: 'model', text: response.text || "Response unavailable." };
      const finalHistory = [...updatedHistory, modelMsg];
      const updatedResult = { ...currentResult, chatHistory: finalHistory };
      setCurrentResult(updatedResult);
      setHistory(history.map(h => h.id === currentResult.id ? updatedResult : h));
    } catch {
      alert("Dialogue service unavailable.");
    } finally {
      setIsDialogueLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!currentResult || !resultsRef.current || isExporting) return;
    setIsExporting(true);
    const element = resultsRef.current;
    const fileName = `Scholarship_${currentResult.question.substring(0, 15).replace(/\s/g, '_')}.pdf`;
    const opt = {
      margin: 0.5,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    try {
      if (typeof html2pdf !== 'undefined') await html2pdf().set(opt).from(element).save();
      else window.print();
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] shadow-2xl p-16 max-w-xl w-full text-center border border-slate-100">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
            <KeyIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black serif mb-4">Initialize Scholarship</h1>
          <p className="text-slate-500 mb-10 leading-relaxed">To access the Tradition Explorer, you must link a project API key. This enables deep reasoning models and protects your session.</p>
          <button onClick={handleSelectKey} className="w-full py-6 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">Link API Key</button>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block mt-6 text-xs font-bold text-slate-400 uppercase hover:text-indigo-600">Billing Documentation</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b sticky top-0 z-[60] no-print h-20 flex items-center justify-between px-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg"><HistoryIcon className="w-6 h-6" /></div>
          <h1 className="text-2xl font-black serif">Tradition Explorer</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setShowHistory(true)} className="px-6 py-3 text-xs font-black uppercase border-2 border-slate-100 rounded-2xl hover:border-indigo-100 hover:text-indigo-600 transition-all">Archives</button>
          {currentResult && (
            <button onClick={handleExportPDF} disabled={isExporting} className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto w-full px-8 py-12">
        <div className="bg-white rounded-[3rem] shadow-2xl p-14 mb-14 no-print border border-slate-100">
          <div className="mb-12">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Thematic Inquiry</label>
            <input 
              type="text" 
              className="w-full px-10 py-8 rounded-[2rem] border-2 border-slate-50 bg-slate-50 text-slate-900 font-bold text-xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              placeholder='e.g. The ethics of AI and personhood...' 
              value={question} 
              onChange={(e) => setQuestion(e.target.value)} 
            />
          </div>
          
          <div className="mb-14">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Select Perspectives (Max 3)</label>
            <div className="flex flex-wrap gap-3">
              {TRADITIONS.map(t => (
                <button key={t} onClick={() => {
                  if (selectedTraditions.includes(t)) setSelectedTraditions(selectedTraditions.filter(x => x !== t));
                  else if (selectedTraditions.length < 3) setSelectedTraditions([...selectedTraditions, t]);
                }} disabled={!selectedTraditions.includes(t) && selectedTraditions.length >= 3} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedTraditions.includes(t) ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30'}`}>{t}</button>
              ))}
            </div>
          </div>
          
          <button onClick={handleGenerate} disabled={isLoading || !question || selectedTraditions.length === 0} className="w-full py-10 bg-indigo-600 text-white font-black uppercase text-base rounded-[2.5rem] shadow-2xl hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50">
            {isLoading ? "Analyzing Archives..." : "Generate Multi-Perspective Analysis"}
          </button>
        </div>

        <div ref={resultsRef} className="space-y-16">
          {currentResult ? (
            <div className="animate-in fade-in slide-in-from-bottom-12 duration-700">
              <div className="pdf-show mb-14 border-b-4 border-slate-900 pb-8">
                <h1 className="text-5xl font-black serif mb-4">{currentResult.question}</h1>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Scholarly Report • {new Date(currentResult.timestamp).toLocaleDateString()}</p>
              </div>

              <div className="fixed bottom-12 right-12 z-[70] no-print">
                 <button onClick={() => setShowDiscussion(true)} className="group flex items-center bg-indigo-600 text-white px-10 py-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all">
                    <MessageIcon className="mr-3 w-6 h-6" />
                    <span className="font-black uppercase text-xs">Scholar Dialogue</span>
                 </button>
              </div>

              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <div key={key} className="mb-14">
                  <div className="flex items-center space-x-6 mb-10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{SECTION_LABELS[key]}</h3>
                    <div className="h-px bg-slate-200 w-full" />
                  </div>
                  <div className={`grid grid-cols-1 ${currentResult.selectedTraditions.length > 1 ? 'lg:grid-cols-2' : ''} xl:grid-cols-3 gap-10`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className="flex flex-col p-12 border-2 rounded-[3rem] bg-white border-slate-50 shadow-sm hover:shadow-xl transition-shadow relative pdf-card">
                        <div className="absolute top-0 right-10 -translate-y-1/2 bg-indigo-600 text-white px-5 py-2 text-[8px] font-black uppercase tracking-widest rounded-full">{tradition}</div>
                        <CustomMarkdown content={currentResult.data[key][tradition] || "Analysis unavailable."} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && (
            <div className="text-center py-56 border-4 border-dashed border-slate-200 rounded-[4rem] opacity-30">
              <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-300">Awaiting Inquiry</p>
            </div>
          )}
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-[110] no-print flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col p-12 animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-4xl font-black serif">Archives</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-900 text-2xl">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-6 pr-4">
              {history.length === 0 && <p className="text-slate-400 text-center py-20 uppercase text-[10px] font-black tracking-widest">No archives found</p>}
              {history.map(item => (
                <button key={item.id} onClick={() => { setCurrentResult(item); setShowHistory(false); setQuestion(item.question); setSelectedTraditions(item.selectedTraditions); }} className="w-full text-left p-10 border-2 border-slate-50 rounded-[2.5rem] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                  <p className="font-bold text-slate-900 line-clamp-2 mb-3 group-hover:text-indigo-600">{item.question}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</p>
                    <div className="flex gap-1">
                      {item.selectedTraditions.map(t => <div key={t} className="w-2 h-2 rounded-full bg-slate-200" title={t} />)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDiscussion && currentResult && (
        <div className="fixed inset-0 z-[100] no-print" onClick={() => setShowDiscussion(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-10 border-b flex items-center justify-between bg-indigo-600 text-white shadow-lg">
              <h2 className="text-2xl font-black serif flex items-center"><MessageIcon className="mr-4 w-8 h-8" />Scholar Dialogue</h2>
              <button onClick={() => setShowDiscussion(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-3xl font-light">✕</button>
            </div>
            <div ref={chatScrollRef} className="flex-grow overflow-y-auto p-10 space-y-10 bg-slate-50/50">
              {currentResult.chatHistory?.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-[2.5rem] p-8 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                    <CustomMarkdown content={msg.text} isUser={msg.role === 'user'} />
                  </div>
                </div>
              ))}
              {isDialogueLoading && <div className="text-[10px] font-black uppercase text-indigo-600 animate-pulse px-6 tracking-widest">Scholar is formulating thoughts...</div>}
            </div>
            <div className="p-10 border-t bg-white">
              <div className="flex space-x-4">
                <textarea 
                  rows={2}>
