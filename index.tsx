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

type SectionKey = 'summary' | 'comparison' | 'discussion' | 'deep dive' | 'conclusion' | 'quotes and references';

type ModelOption = 'gemini-3-flash-preview' | 'gemini-3-pro-preview' | 'gemini-2.5-flash-lite-latest';

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
  modelUsed: string;
  data: {
    [key in SectionKey]: TraditionContent;
  };
  chatHistory?: ChatMessage[];
}

const TRADITIONS: Tradition[] = [
  'Fundamentalist Christianity', 'Judaism', 'Stoicism', 'Mainstream Christianity',
  'Catholicism', 'Islam', 'Humanism', 'Buddhism', 'Taoism', 'Hinduism'
];

const EXAMPLE_QUERIES = [
  "Why should we forgive our enemies?",
  "How is homosexuality viewed?",
  "Is it ever acceptable to tell a lie for a greater good?",
  "What are our moral obligations to our parents and elders?",
  "What is the importance of charity and helping the poor?",
  "Should artificial intelligence be granted moral status or rights?",
  "Is the pursuit of individual happiness more important than collective duty?",
  "How should we view our responsibility toward the environment?",
  "Does the concept of 'free will' fundamentally change our view of moral responsibility?",
  "What is the source of objective morality, if it exists at all?"
];

const SECTION_LABELS: Record<string, string> = {
  'summary': 'Concise Stance',
  'comparison': 'Thematic Comparison',
  'discussion': 'Nuanced Discussion',
  'deep dive': 'Foundational Logic',
  'conclusion': 'Final Synthesis',
  'quotes and references': 'Glossary & Resources'
};

const DEFAULT_SYSTEM_PROMPT = `You are a world-class scholarly mentor and ethics researcher. Respond ONLY in valid JSON.

STRICT TONE & READING LEVEL RULES:
1. 'summary' (Concise Stance): MUST be written at an 8th-grade reading level. Use simple vocabulary and short sentences. No jargon.
2. ALL OTHER SECTIONS: MUST be written at a College Graduate / Academic Researcher level. Use sophisticated vocabulary and technical terminology.

STRICT CITATION & LINK RULES (LINK MIGRATION):
1. ZERO LINKS IN ANALYSIS: DO NOT place any Markdown links ([text](url)), raw URLs, or bracketed citations in 'summary', 'comparison', 'discussion', 'deep dive', or 'conclusion'.
2. CAPTURE AND RELOCATE: If, during your research for the analysis sections, you encounter a relevant primary source URL, citation, or reference link, DO NOT DISCARD IT. You must REMEMBER these links and MOVE them into the 'quotes and references' section.
3. GLOSSARY CONTENT: The 'quotes and references' section must be a rich repository of all links discovered during the entire generation process. Each link should have a clear title and a brief description of what it supports in the analysis.
4. LINK QUALITY: Use Google Search to find deep-links to specific chapters/verses/articles. No general homepages.

JSON Structure must strictly follow the provided responseSchema. Each section must contain an entry for every tradition requested.`;

// --- ICONS ---
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
const MessageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const KeyIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3L15.5 7.5z"/></svg>
);
const ChevronDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

// --- HELPERS ---
const CustomMarkdown: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser }) => (
  <div className={`prose prose-sm max-w-none break-words overflow-hidden prose-headings:serif prose-headings:text-slate-900 ${isUser ? 'prose-invert' : 'prose-slate text-slate-800'} prose-a:text-indigo-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline`}>
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]} 
      rehypePlugins={[rehypeSlug]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} className="break-all md:break-words" target="_blank" rel="noopener noreferrer" />
        )
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const LoadingSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="animate-pulse space-y-16 py-10">
    {[1, 2].map((i) => (
      <div key={i}>
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-10"></div>
        <div className={`grid gap-10 ${count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {Array.from({ length: count }).map((_, j) => (
            <div key={j} className="p-12 border-2 border-slate-50 rounded-[3rem] bg-white h-96 space-y-4">
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
              <div className="h-4 bg-slate-50 rounded w-full"></div>
              <div className="h-4 bg-slate-50 rounded w-5/6"></div>
              <div className="h-4 bg-slate-50 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// --- MAIN APP ---
const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [history, setHistory] = useState<ComparisonResult[]>(() => {
    const saved = localStorage.getItem('tradition_explorer_history_v8');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentResult, setCurrentResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<Tradition[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('gemini-3-flash-preview');
  const [showHistory, setShowHistory] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [dialogueInput, setDialogueInput] = useState('');
  const [isDialogueLoading, setIsDialogueLoading] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window.aistudio !== 'undefined' && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected || (!!process.env.API_KEY && process.env.API_KEY !== "undefined"));
      } else {
        setHasKey(!!process.env.API_KEY && process.env.API_KEY !== "undefined");
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem('tradition_explorer_history_v8', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentResult?.chatHistory, isDialogueLoading]);

  const handleSelectKey = async () => {
    if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    setIsLoading(true);
    setCurrentResult(null); 
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Dynamic but simple schema
    const traditionProps = selectedTraditions.reduce((a, t) => ({...a, [t]: {type: Type.STRING}}), {});
    const traditionSchema = { type: Type.OBJECT, properties: traditionProps, required: selectedTraditions };
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: traditionSchema,
        comparison: traditionSchema,
        discussion: traditionSchema,
        "deep dive": traditionSchema,
        conclusion: traditionSchema,
        "quotes and references": traditionSchema,
      },
      required: ["summary", "comparison", "discussion", "deep dive", "conclusion", "quotes and references"],
    };

    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Topic: "${question}". Perspectives: ${selectedTraditions.join(', ')}. 
        
        Mandatory:
        - Summary: 8th grade.
        - Analysis sections: Academic graduate level.
        - IMPORTANT: Remember all source links found during analysis and move them into the 'quotes and references' section. Analysis sections must contain NO links.`,
        config: {
          systemInstruction: DEFAULT_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          tools: [{ googleSearch: {} }],
        },
      });

      const data = JSON.parse(response.text || "{}");
      const res: ComparisonResult = {
        id: crypto.randomUUID(),
        question,
        selectedTraditions,
        timestamp: Date.now(),
        modelUsed: selectedModel,
        data,
        chatHistory: []
      };
      
      setCurrentResult(res);
      setHistory(prev => [res, ...prev]);
    } catch (err: any) {
      console.error("RPC/Analysis error:", err);
      alert(`Scholarly analysis failed. This is often due to API timeouts. Please try again with fewer traditions or a shorter prompt. (Error: ${err.message})`);
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
    const context = `Scholar dialogue. Topic: "${currentResult.question}". Academic tone.`;
    
    try {
      const chat = ai.chats.create({ 
        model: selectedModel, 
        config: { systemInstruction: context, tools: [{ googleSearch: {} }] } 
      });
      const response = await chat.sendMessage({ message: input });
      const modelMsg: ChatMessage = { role: 'model', text: response.text || "Connection lost." };
      const finalHistory = [...updatedHistory, modelMsg];
      const updatedResult = { ...currentResult, chatHistory: finalHistory };
      setCurrentResult(updatedResult);
      setHistory(history.map(h => h.id === currentResult.id ? updatedResult : h));
    } catch (err: any) {
      console.error("Dialogue Error:", err);
    } finally {
      setIsDialogueLoading(false);
    }
  };

  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[3rem] shadow-2xl p-16 max-w-xl w-full border border-slate-100">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
            <KeyIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black serif mb-4">Initialize Scholarship</h1>
          <button onClick={handleSelectKey} className="w-full py-6 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">Link API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b sticky top-0 z-[60] h-20 flex items-center justify-between px-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black serif tracking-tight">Ethics and Traditions explorer</h1>
        </div>
        <button onClick={() => setShowHistory(true)} className="px-6 py-3 text-xs font-black uppercase border-2 border-slate-100 rounded-2xl hover:border-indigo-100 hover:text-indigo-600 transition-all">
          Archives
        </button>
      </header>

      <main className="flex-grow max-w-6xl mx-auto w-full px-8 py-12">
        <div className="bg-white rounded-[3rem] shadow-2xl p-14 mb-14 border border-slate-100">
          <div className="mb-8">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Thematic Inquiry</label>
            <div className="flex flex-col space-y-4">
              <input 
                type="text" 
                className="w-full px-10 py-8 rounded-[2rem] border-2 border-slate-50 bg-slate-50 text-slate-900 font-bold text-xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                placeholder='e.g. The source of objective morality...' 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
              />
              <button onClick={() => setShowExamples(!showExamples)} className="self-start px-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center">
                Inspiration <ChevronDown className={`ml-2 transition-transform duration-300 ${showExamples ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {showExamples && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                {EXAMPLE_QUERIES.map((ex, i) => (
                  <button key={i} onClick={() => { setQuestion(ex); setShowExamples(false); }} className="text-left px-5 py-4 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="mb-14">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">Select Perspectives (Limit 3)</label>
            <div className="flex flex-wrap gap-3">
              {TRADITIONS.map(t => (
                <button 
                  key={t} 
                  onClick={() => {
                    if (selectedTraditions.includes(t)) setSelectedTraditions(selectedTraditions.filter(x => x !== t));
                    else if (selectedTraditions.length < 3) setSelectedTraditions([...selectedTraditions, t]);
                  }} 
                  disabled={!selectedTraditions.includes(t) && selectedTraditions.length >= 3} 
                  className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedTraditions.includes(t) ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Research Precision</label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                className="w-full appearance-none px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:border-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="gemini-3-flash-preview">Flash (High Velocity - Recommended)</option>
                <option value="gemini-3-pro-preview">Pro (Maximum Insight)</option>
                <option value="gemini-2.5-flash-lite-latest">Lite (Fast Overview)</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button onClick={handleGenerate} disabled={isLoading || !question || selectedTraditions.length === 0} className="w-full py-5 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                {isLoading ? "Consulting Traditions..." : "Execute Comparative Analysis"}
              </button>
            </div>
          </div>
        </div>

        <div ref={resultsRef} className="space-y-16">
          {isLoading && <LoadingSkeleton count={selectedTraditions.length} />}
          
          {currentResult && !isLoading ? (
            <div className="animate-in">
              <div className="mb-14 border-b-4 border-slate-900 pb-8">
                <h1 className="text-5xl font-black serif mb-4 leading-tight">{currentResult.question}</h1>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Report generated via {currentResult.modelUsed.replace('-preview', '')}
                </p>
              </div>

              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <div key={key} className="mb-16">
                  <div className="flex items-center space-x-6 mb-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">
                      {SECTION_LABELS[key]}
                    </h3>
                    <div className="h-px bg-slate-200 w-full" />
                  </div>
                  <div className={`grid gap-10 ${getGridClass(currentResult.selectedTraditions.length)}`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className={`flex flex-col p-10 border-2 rounded-[2.5rem] bg-white border-slate-50 shadow-sm relative min-w-0 ${key === 'quotes and references' ? 'border-indigo-200 bg-indigo-50/20' : ''}`}>
                        <div className="absolute top-0 right-10 -translate-y-1/2 bg-slate-900 text-white px-5 py-2 text-[8px] font-black uppercase tracking-widest rounded-full">
                          {tradition}
                        </div>
                        <CustomMarkdown content={currentResult.data[key]?.[tradition] || "Analysis pending archival verification."} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && (
            <div className="text-center py-56 border-4 border-dashed border-slate-200 rounded-[4rem] opacity-30">
              <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-300">Scholar Standby</p>
            </div>
          )}
        </div>
      </main>

      {currentResult && (
        <div className="fixed bottom-12 right-12 z-[70]">
          <button onClick={() => setShowDiscussion(true)} className="flex items-center bg-indigo-600 text-white px-10 py-6 rounded-full shadow-2xl hover:scale-110 transition-all">
            <MessageIcon className="mr-3 w-6 h-6" />
            <span className="font-black uppercase text-xs">Scholar Dialogue</span>
          </button>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[110] flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white p-12 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black serif">Archives</h2>
              <button onClick={() => setShowHistory(false)} className="text-2xl">✕</button>
            </div>
            <div className="space-y-6">
              {history.length === 0 ? <p className="text-slate-400 italic">No past analyses found.</p> : history.map(item => (
                <button key={item.id} onClick={() => { setCurrentResult(item); setShowHistory(false); setQuestion(item.question); setSelectedTraditions(item.selectedTraditions); }} className="w-full text-left p-8 border-2 border-slate-50 rounded-[2rem] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                  <p className="font-bold text-slate-900 mb-2 line-clamp-2">{item.question}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase">{new Date(item.timestamp).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDiscussion && currentResult && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowDiscussion(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-10 border-b flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-2xl font-black serif">Scholar Dialogue</h2>
              <button onClick={() => setShowDiscussion(false)} className="text-3xl font-light">✕</button>
            </div>
            <div ref={chatScrollRef} className="flex-grow overflow-y-auto p-10 space-y-8 bg-slate-50/50">
              {currentResult.chatHistory?.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-[2.5rem] p-8 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-slate-800 rounded-bl-none'}`}>
                    <CustomMarkdown content={msg.text} isUser={msg.role === 'user'} />
                  </div>
                </div>
              ))}
              {isDialogueLoading && <div className="text-[10px] font-black uppercase text-indigo-600 animate-pulse">Researching...</div>}
            </div>
            <div className="p-10 border-t bg-white">
              <div className="flex space-x-4">
                <textarea rows={2} className="flex-grow p-8 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-indigo-500 resize-none shadow-inner" placeholder="Inquire further..." value={dialogueInput} onChange={(e) => setDialogueInput(e.target.value)} />
                <button onClick={handleSendDialogue} disabled={isDialogueLoading || !dialogueInput.trim()} className="px-10 bg-indigo-600 text-white font-black uppercase text-xs rounded-[2rem] shadow-xl">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
