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

type ModelOption = 'gemini-3-flash-preview' | 'gemini-3-pro-preview' | 'gemini-2.5-flash-lite-latest';

interface TraditionContent {
  [tradition: string]: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface GroundingSource {
  title: string;
  uri: string;
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
  sources?: GroundingSource[];
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
  'quotes and references': 'Glossary & Resources',
  'conclusion': 'Final Synthesis'
};

const DEFAULT_SYSTEM_PROMPT = `You are a world-class scholarly mentor. Respond ONLY in valid JSON.
Analyze the provided question from the perspective of each selected tradition.

STRICT CONTENT RULES:
1. 'summary': Provide a MAXIMUM of 1-2 sentences per tradition. Write this section for an 8th-grade reading level (clear, simple, no jargon). It should be an "elevator pitch" of their core stance.
2. CITATIONS & HYPERLINKS: Every assertion or argument MUST be bolstered by a clickable Markdown hyperlink to a primary source, official text, or reputable academic encyclopedia (e.g., [Source Name](URL)). Include multiple links per tradition in every section.
3. NO OVERLAP: Each section MUST provide entirely new information. Do not repeat facts or arguments already stated in previous sections.
4. Section-Specific Focus:
   - 'comparison': Focus strictly on how traditions differ from or align with each other. Use links to comparative studies.
   - 'discussion': Explore internal debates, historical evolution, or modern edge-cases. Link to modern scholarship.
   - 'deep dive': Explain specific metaphysical/logical frameworks (scriptures, axioms). Link to the full text of scriptures or philosophical treatises.
5. Format: { "section_name": { "Tradition Name": "Markdown content with [Hyperlinks](URL)..." } }`;

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
const AlertIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
const ChevronDown = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);
const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></svg>
);

declare var html2pdf: any;
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
  <div className={`prose prose-sm max-w-none prose-headings:serif prose-headings:text-slate-900 ${isUser ? 'prose-invert' : 'prose-slate text-slate-800'} prose-a:text-indigo-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
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
    const saved = localStorage.getItem('tradition_explorer_history_v4');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentResult, setCurrentResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [question, setQuestion] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<Tradition[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('gemini-3-flash-preview');
  const [showHistory, setShowHistory] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [dialogueInput, setDialogueInput] = useState('');
  const [isDialogueLoading, setIsDialogueLoading] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  
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
    localStorage.setItem('tradition_explorer_history_v4', JSON.stringify(history));
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
    setFallbackNotice(null);
    setCurrentResult(null); 
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const traditionSchemaProperties = selectedTraditions.reduce((acc, trad) => {
      acc[trad] = { type: Type.STRING };
      return acc;
    }, {} as any);
    const sectionSchema = { type: Type.OBJECT, properties: traditionSchemaProperties, required: selectedTraditions };
    const responseSchema = {
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
    };

    try {
      const config: any = {
        systemInstruction: DEFAULT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        tools: [{ googleSearch: {} }]
      };

      // Apply thinking budget to Pro model for "thoughtful" reasoning
      if (selectedModel === 'gemini-3-pro-preview') {
        config.thinkingConfig = { thinkingBudget: 8192 };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Provide a structured multi-perspective analysis of: "${question}" through the lens of: ${selectedTraditions.join(', ')}. Ensure academic rigor, absolute lack of repetition between sections, 8th-grade level summaries, and clickable scholarly URLs.`,
        config,
      });

      // Extract grounding sources
      const sources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({ title: chunk.web.title || chunk.web.uri, uri: chunk.web.uri });
          }
        });
      }

      const res: ComparisonResult = {
        id: crypto.randomUUID(),
        question,
        selectedTraditions,
        timestamp: Date.now(),
        modelUsed: selectedModel,
        data: JSON.parse(response.text || "{}"),
        chatHistory: [],
        sources: sources.length > 0 ? sources : undefined
      };
      
      setCurrentResult(res);
      setHistory(prev => [res, ...prev]);
    } catch (err: any) {
      console.warn("API call failed:", err);
      
      if (err.message?.includes("Requested entity was not found") || err.message?.includes("API key not valid")) {
        setHasKey(false);
        if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
          await window.aistudio.openSelectKey();
          setHasKey(true);
        }
      } else {
        alert(`Analysis error: ${err.message || 'Unknown error'}. Please verify your network or API key.`);
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
    const context = `You are a mentor. User is asking about: "${currentResult.question}". Focus Traditions: ${currentResult.selectedTraditions.join(', ')}. Result Context: ${JSON.stringify(currentResult.data).substring(0, 1000)}. Always provide clickable Markdown links to sources.`;
    
    try {
      const chat = ai.chats.create({ 
        model: selectedModel, 
        config: { systemInstruction: context, tools: [{ googleSearch: {} }] } 
      });
      const response = await chat.sendMessage({ message: input });
      const modelMsg: ChatMessage = { role: 'model', text: response.text || "I was unable to formulate a response." };
      const finalHistory = [...updatedHistory, modelMsg];
      const updatedResult = { ...currentResult, chatHistory: finalHistory };
      setCurrentResult(updatedResult);
      setHistory(history.map(h => h.id === currentResult.id ? updatedResult : h));
    } catch (err: any) {
      console.error("Dialogue Error:", err);
      alert("The scholar dialogue is currently unavailable.");
    } finally {
      setIsDialogueLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!currentResult || !resultsRef.current || isExporting) return;
    setIsExporting(true);
    const element = resultsRef.current;
    const fileName = `Analysis_${currentResult.question.substring(0, 20).replace(/\s/g, '_')}.pdf`;
    
    const opt = {
      margin: [0.3, 0.3],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-card', '.pdf-header'] }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(element).save();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("PDF Export failed:", err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] shadow-2xl p-16 max-w-xl w-full text-center border border-slate-100">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
            <KeyIcon className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black serif mb-4">Initialize Scholarship</h1>
          <p className="text-slate-500 mb-10 leading-relaxed">
            To access high-tier reasoning models, you must link an API key from a paid Google Cloud project. 
          </p>
          <button 
            onClick={handleSelectKey} 
            className="w-full py-6 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
          >
            Link API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b sticky top-0 z-[60] no-print h-20 flex items-center justify-between px-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black serif tracking-tight">Ethics and Traditions explorer</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowHistory(true)} 
            className="px-6 py-3 text-xs font-black uppercase border-2 border-slate-100 rounded-2xl hover:border-indigo-100 hover:text-indigo-600 transition-all"
          >
            Archives
          </button>
          {currentResult && (
            <button 
              onClick={handleExportPDF} 
              disabled={isExporting} 
              className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-6xl mx-auto w-full px-8 py-12">
        <div className="bg-white rounded-[3rem] shadow-2xl p-14 mb-14 no-print border border-slate-100">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thematic Inquiry</label>
              <button 
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Need inspiration?
                <ChevronDown className={`ml-2 transition-transform duration-300 ${showExamples ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {showExamples && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 p-6 bg-slate-50 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300 border border-slate-100">
                {EXAMPLE_QUERIES.map((ex, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setQuestion(ex); setShowExamples(false); }}
                    className="text-left px-5 py-4 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 hover:shadow-sm line-clamp-2"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}

            <input 
              type="text" 
              className="w-full px-10 py-8 rounded-[2rem] border-2 border-slate-50 bg-slate-50 text-slate-900 font-bold text-xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              placeholder='e.g. The morality of genetic engineering...' 
              value={question} 
              onChange={(e) => setQuestion(e.target.value)} 
            />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Analysis Depth</label>
              <div className="relative group">
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                  className="w-full appearance-none px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                  <option value="gemini-3-flash-preview">Flash (Faster & Balanced)</option>
                  <option value="gemini-3-pro-preview">Pro (Slower & Thoughtful Reasoning)</option>
                  <option value="gemini-2.5-flash-lite-latest">Lite (Ultra Fast Efficiency)</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <ChevronDown />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                onClick={handleGenerate} 
                disabled={isLoading || !question || selectedTraditions.length === 0} 
                className="w-full py-5 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
              >
                {isLoading ? (
                   <span className="flex items-center">
                     <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Consulting the Scholars...
                   </span>
                ) : (
                  <>
                    <SparklesIcon />
                    <span>Generate Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div ref={resultsRef} className="space-y-16 pdf-container">
          {isLoading && <LoadingSkeleton count={selectedTraditions.length} />}
          
          {currentResult && !isLoading ? (
            <div className="animate-in fade-in slide-in-from-bottom-12 duration-700">
              <div className="mb-14 border-b-4 border-slate-900 pb-8 pdf-header">
                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Thematic Inquiry</div>
                <h1 className="text-5xl font-black serif mb-4 leading-tight">{currentResult.question}</h1>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Scholarly Report • {new Date(currentResult.timestamp).toLocaleDateString()} • {currentResult.modelUsed.includes('pro') ? 'Deep Tier' : 'Flash Tier'}
                </p>
                {currentResult.sources && (
                  <div className="mt-8 no-print">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Foundational Web Sources</h4>
                    <div className="flex flex-wrap gap-4">
                      {currentResult.sources.map((source, sIdx) => (
                        <a 
                          key={sIdx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 bg-slate-100 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors border border-transparent hover:border-indigo-100"
                        >
                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[200px]">{source.title}</span>
                          <ExternalLinkIcon className="text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="fixed bottom-12 right-12 z-[70] no-print">
                 <button 
                  onClick={() => setShowDiscussion(true)} 
                  className="group flex items-center bg-indigo-600 text-white px-10 py-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
                 >
                    <MessageIcon className="mr-3 w-6 h-6" />
                    <span className="font-black uppercase text-xs">Scholar Dialogue</span>
                 </button>
              </div>

              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <div key={key} className="mb-16 pdf-section-group">
                  <div className="flex items-center space-x-6 mb-8 pdf-section-title">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{SECTION_LABELS[key]}</h3>
                    <div className="h-px bg-slate-200 w-full" />
                  </div>
                  <div className={`grid gap-10 ${getGridClass(currentResult.selectedTraditions.length)}`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div 
                        key={tradition} 
                        className="flex flex-col p-10 border-2 rounded-[2.5rem] bg-white border-slate-50 shadow-sm hover:shadow-xl transition-shadow relative pdf-card"
                      >
                        <div className="absolute top-0 right-10 -translate-y-1/2 bg-indigo-600 text-white px-5 py-2 text-[8px] font-black uppercase tracking-widest rounded-full">
                          {tradition}
                        </div>
                        <CustomMarkdown content={currentResult.data[key][tradition] || "Analysis unavailable."} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && (
            <div className="text-center py-56 border-4 border-dashed border-slate-200 rounded-[4rem] opacity-30">
              <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-300">Awaiting Scholarship</p>
            </div>
          )}
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-[110] no-print flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
          <div 
            className="relative w-full max-w-md bg-white shadow-2xl flex flex-col p-12 animate-in slide-in-from-right duration-300" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-4xl font-black serif">Archives</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-900 text-2xl">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-6 pr-4">
              {history.length === 0 && <p className="text-slate-400 text-center py-20 uppercase text-[10px] font-black tracking-widest">No archives found</p>}
              {history.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => { setCurrentResult(item); setShowHistory(false); setQuestion(item.question); setSelectedTraditions(item.selectedTraditions); }} 
                  className="w-full text-left p-10 border-2 border-slate-50 rounded-[2.5rem] hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                >
                  <p className="font-bold text-slate-900 line-clamp-2 mb-3 group-hover:text-indigo-600">{item.question}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </p>
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
          <div 
            className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-10 border-b flex items-center justify-between bg-indigo-600 text-white shadow-lg">
              <h2 className="text-2xl font-black serif flex items-center">
                <MessageIcon className="mr-4 w-8 h-8" />
                Scholar Dialogue
              </h2>
              <button onClick={() => setShowDiscussion(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-3xl font-light">✕</button>
            </div>
            <div ref={chatScrollRef} className="flex-grow overflow-y-auto p-10 space-y-10 bg-slate-50/50">
              {currentResult.chatHistory?.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-[2.5rem] p-8 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}
                  >
                    <CustomMarkdown content={msg.text} isUser={msg.role === 'user'} />
                  </div>
                </div>
              ))}
              {isDialogueLoading && (
                <div className="text-[10px] font-black uppercase text-indigo-600 animate-pulse px-6 tracking-widest">
                  The scholar is formulating a response...
                </div>
              )}
            </div>
            <div className="p-10 border-t bg-white">
              <div className="flex space-x-4">
                <textarea 
                  rows={2} 
                  className="flex-grow p-8 text-base border-2 border-slate-100 rounded-[2rem] outline-none focus:border-indigo-500 transition-all resize-none shadow-inner bg-white text-slate-900" 
                  placeholder="Inquire further..." 
                  value={dialogueInput} 
                  onChange={(e) => setDialogueInput(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDialogue(); } }} 
                />
                <button 
                  onClick={handleSendDialogue} 
                  disabled={isDialogueLoading || !dialogueInput.trim()} 
                  className="px-10 bg-indigo-600 text-white font-black uppercase text-xs tracking-[0.2em] rounded-[2rem] shadow-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all"
                >
                  Send
                </button>
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
