
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// --- TYPES ---
export type Tradition = 
  | 'Fundamentalist Christianity' | 'Judaism' | 'Stoicism' | 'Mainstream Christianity'
  | 'Catholicism' | 'Islam' | 'Humanism' | 'Buddhism' | 'Taoism' | 'Hinduism';

export type SectionKey = 'summary' | 'comparison' | 'discussion' | 'deep dive' | 'quotes and references' | 'conclusion';

export interface TraditionContent {
  [tradition: string]: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ComparisonResult {
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
export const TRADITIONS: Tradition[] = [
  'Fundamentalist Christianity', 'Judaism', 'Stoicism', 'Mainstream Christianity',
  'Catholicism', 'Islam', 'Humanism', 'Buddhism', 'Taoism', 'Hinduism'
];

export const SECTION_LABELS: Record<string, string> = {
  'summary': 'Executive Summary',
  'comparison': 'Thematic Comparison',
  'discussion': 'Nuanced Discussion',
  'deep dive': 'Educational Deep Dive',
  'quotes and references': 'Glossary & Resources',
  'conclusion': 'Final Synthesis'
};

export const EXAMPLE_QUERIES = [
  "The ethics of artificial intelligence and machine consciousness",
  "The 'Just War' theory versus absolute pacifism",
  "Environmental stewardship: Master vs. Guardian",
  "The nature of suffering: Test, Cycle, or Flaw?",
  "Physician-assisted suicide and personal autonomy",
  "Animal rights and the moral hierarchy of beings",
  "Individual liberty vs. communal responsibility",
  "Forgiveness and reconciliation after deep trauma",
  "Objective morality vs. moral relativism",
  "Marriage and family: Tradition vs. Evolving Contracts"
];

export const DEFAULT_SYSTEM_PROMPT = `You are a pedagogical mentor and world-class scholar.
Your goal is to explain complex ideas to someone with little to no prior knowledge.

CRITICAL INSTRUCTIONS:
1. PEDAGOGY: Assume the user is a total beginner. Explain "How" and "Why". Define all specialized terminology (e.g., 'Agape', 'Karma', 'Satori', 'Categorical Imperative') upon first use.
2. DEEP DIVE: This section must be the most detailed. Break down the internal logic, historical context, and core tenets of each tradition. Use bullet points and sub-headers for readability.
3. GLOSSARY: In the 'quotes and references' section, provide a "Technical Glossary". Each term must be its own '### Term Name' header.
4. CROSS-LINKING: In all other sections, whenever you use a technical term from your glossary, link to it using Markdown syntax: [Term Name](#term-name). 
5. EXTERNAL RESOURCES: In the 'quotes and references' section, provide actual, high-quality URLs to scholarly sites like the Stanford Encyclopedia of Philosophy (plato.stanford.edu) or official religious archives.
6. FORMAT: Respond strictly in JSON. Use standard Markdown in values. Ensure high contrast in your descriptions.`;

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
const MessageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);

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
  const sectionSchema = {
    type: Type.OBJECT,
    properties: traditionSchemaProperties,
    required: traditions,
  };
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Provide a detailed pedagogical comparison for: "${question}". Perspectives: ${traditions.join(', ')}. Remember to use anchors [Term](#term) for technical concepts.`,
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
  } catch (err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
};

const sendChatMessage = async (
  message: string,
  history: ChatMessage[],
  context: ComparisonResult
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contextSummary = `You are a pedagogical mentor discussing an analysis on: "${context.question}".
Context: ${JSON.stringify(context.data).substring(0, 1500)}...
Maintain high readability. Use dark text colors. Define terms.`;

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: { systemInstruction: contextSummary }
  });

  const response = await chat.sendMessage({ message: message });
  return response.text || "I apologize, I am unable to respond right now.";
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
        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-widest">{title}</h3>
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

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
    } catch (error) {
      setMessages([...newMessages, { role: 'model', text: "Error: Could not connect to the mentor." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden no-print">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center"><MessageIcon className="mr-2 text-indigo-600" />Discuss Analysis</h2>
            <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Scholarly Mentorship Session</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">✕</button>
        </div>
        <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm prose-slate max-w-none">
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div className="flex justify-start"><div className="bg-white border p-3 rounded-xl animate-pulse text-xs text-slate-400">Mentorship active... formulating response...</div></div>}
        </div>
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex space-x-2">
            <textarea rows={2} className="flex-grow p-3 text-sm border border-slate-300 rounded-xl outline-none resize-none focus:ring-2 focus:ring-indigo-500" placeholder="Seek clarification or deeper insight..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
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
  const [showDiscussion, setShowDiscussion] = useState(false);
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

  const uniqueQuestions: string[] = Array.from(new Set(history.map(h => h.question)));
  const handleToggleTradition = (tradition: Tradition) => {
    if (selectedTraditions.includes(tradition)) setSelectedTraditions(selectedTraditions.filter(t => t !== tradition));
    else if (selectedTraditions.length < 3) setSelectedTraditions([...selectedTraditions, tradition]);
  };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    setIsLoading(true);
    setIsDropdownOpen(false);
    try {
      const result = await generateComparison(question, selectedTraditions, systemPrompt);
      setCurrentResult(result);
      setHistory(prev => [result, ...prev]);
    } catch (error) { alert("API connectivity issue. Please ensure your project has the correct keys."); } finally { setIsLoading(false); }
  };

  const updateChatHistory = (newChatHistory: ChatMessage[]) => {
    if (!currentResult) return;
    const updatedResult = { ...currentResult, chatHistory: newChatHistory };
    setCurrentResult(updatedResult);
    setHistory(prev => prev.map(item => item.id === updatedResult.id ? updatedResult : item));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><HistoryIcon className="w-6 h-6" /></div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Glenn's Tradition Explorer</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowSystemPrompt(!showSystemPrompt)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full" title="Mentor Config"><SettingsIcon /></button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center space-x-1 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-slate-50 transition-all"><HistoryIcon className="w-4 h-4" /><span>History</span></button>
            {currentResult && (
              <div className="flex space-x-2">
                <button onClick={() => setShowDiscussion(true)} className="flex items-center space-x-1 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg transition-all"><MessageIcon className="w-4 h-4" /><span>Discuss</span></button>
                <button onClick={() => window.print()} className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"><Download className="w-4 h-4" /><span>PDF Report</span></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 mb-8 no-print">
          <div className="mb-6 relative" ref={dropdownRef}>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Enter Research Topic</label>
            <div className="relative">
              <input type="text" className="w-full pl-4 pr-12 py-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-lg outline-none shadow-inner text-slate-900" placeholder='e.g., "The philosophical roots of mercy"' value={question} onChange={(e) => setQuestion(e.target.value)} onFocus={() => uniqueQuestions.length > 0 && setIsDropdownOpen(true)} />
              {uniqueQuestions.length > 0 && <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><ChevronDown className={isDropdownOpen ? 'rotate-180 transition-all' : ''} /></button>}
            </div>
            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                {uniqueQuestions.filter(q => q.toLowerCase().includes(question.toLowerCase())).map((q, idx) => (
                  <button key={idx} onClick={() => { setQuestion(q); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b last:border-0 truncate text-slate-700 font-medium">{q}</button>
                ))}
              </div>
            )}
          </div>
          <div className="mb-6">
             <button onClick={() => setShowExamples(!showExamples)} className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center space-x-2"><span>✨ Explore Scholarly Templates</span><ChevronDown className={showExamples ? 'rotate-180 transition-all' : ''} /></button>
             {showExamples && <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {EXAMPLE_QUERIES.map((ex, i) => <button key={i} onClick={() => {setQuestion(ex); setShowExamples(false);}} className="text-left p-3 text-xs bg-slate-50 border rounded-lg hover:border-indigo-400 text-slate-700 font-medium transition-all leading-relaxed">{ex}</button>)}
             </div>}
          </div>
          <div className="mb-8">
            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Tradition Focus (Select Up to 3)</label>
            <div className="flex flex-wrap gap-2">
              {TRADITIONS.map(t => (
                <button key={t} onClick={() => handleToggleTradition(t)} disabled={!selectedTraditions.includes(t) && selectedTraditions.length >= 3} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${selectedTraditions.includes(t) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t pt-6">
            <button onClick={handleGenerate} disabled={isLoading || !question || selectedTraditions.length === 0} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-3">
              {isLoading ? <span className="animate-pulse">Retrieving Wisdom...</span> : <span>Initiate Analysis</span>}
            </button>
          </div>
        </div>

        <div id="results-display" ref={resultsRef} className="space-y-8">
          {currentResult ? (
            <div className="animate-in fade-in duration-700">
              <div className="hidden print-only pdf-show pdf-title-block mb-10 border-b-4 border-slate-900 pb-6">
                <h1 className="text-4xl font-bold serif text-slate-900 leading-tight mb-4">{currentResult.question}</h1>
                <div className="flex items-center space-x-6 text-sm font-bold uppercase tracking-widest text-slate-500">
                  <span>Traditions: {currentResult.selectedTraditions.join(' • ')}</span>
                  <span>{new Date(currentResult.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <CollapsibleSection key={key} title={SECTION_LABELS[key]} defaultOpen={true}>
                  <div className={`grid grid-cols-1 ${currentResult.selectedTraditions.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-8`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className={`flex flex-col h-full rounded-2xl p-6 border-l-4 ${key === 'deep dive' ? 'bg-indigo-50/40 border-indigo-500 ring-1 ring-indigo-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <h4 className="font-bold text-slate-900 text-lg mb-4 flex items-center">
                          <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full mr-3 shadow-sm"></span>
                          {tradition}
                        </h4>
                        <div className="prose prose-slate prose-sm max-w-none prose-headings:serif prose-a:text-indigo-600 prose-a:font-bold prose-a:underline text-slate-800 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentResult.data[key][tradition] || "Analysis documentation pending."}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          ) : !isLoading && <div className="text-center py-32 border-4 border-dashed border-slate-200 rounded-3xl"><h3 className="text-2xl font-serif text-slate-400 italic">"He who knows others is wise; he who knows himself is enlightened." — Lao Tzu</h3></div>}
        </div>
      </main>

      {showDiscussion && currentResult && <DiscussionSidebar isOpen={showDiscussion} onClose={() => setShowDiscussion(false)} result={currentResult} onUpdateHistory={updateChatHistory} />}
      
      {showSystemPrompt && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md no-print"><div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8"><h2 className="text-2xl font-bold mb-4 text-slate-800">Inquiry Protocols</h2><p className="text-sm text-slate-500 mb-4 font-medium italic">Adjust the AI's analytical lens and pedagogical depth.</p><textarea className="w-full h-80 p-4 border rounded-xl font-mono text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 text-slate-700" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} /><div className="mt-6 flex justify-end space-x-4"><button onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)} className="text-slate-500 font-bold hover:text-slate-800 transition-colors">Default</button><button onClick={() => setShowSystemPrompt(false)} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Save Protocols</button></div></div></div>}
      
      {showHistory && (
        <div className="fixed inset-0 z-[100] no-print" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center"><HistoryIcon className="mr-3 text-indigo-600" />Research Archives</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-light">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {history.length > 0 ? history.map((item) => (
                <button key={item.id} onClick={() => { setCurrentResult(item); setShowHistory(false); setQuestion(item.question); setSelectedTraditions(item.selectedTraditions); }} className="w-full text-left p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all group shadow-sm bg-white">
                  <p className="font-bold text-slate-800 line-clamp-2 leading-snug mb-3 group-hover:text-indigo-700">{item.question}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {item.selectedTraditions.map(t => <span key={t} className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded text-slate-500 uppercase tracking-tighter shadow-inner border border-slate-200">{t}</span>)}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-sans">{new Date(item.timestamp).toLocaleDateString()}</span>
                    {item.chatHistory && item.chatHistory.length > 0 && <span className="flex items-center text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full"><MessageIcon className="w-3 h-3 mr-1" /> {item.chatHistory.length}</span>}
                  </div>
                </button>
              )) : <div className="text-center py-20 text-slate-300 italic font-serif">The path of inquiry awaits its first steps.</div>}
            </div>
            <div className="p-6 border-t bg-slate-50">
               <button onClick={() => { if(confirm("Archiving all previous data permanently?")) {setHistory([]); setCurrentResult(null);} }} className="w-full flex items-center justify-center space-x-2 py-4 bg-white text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors border-2 border-red-50 shadow-sm"><Trash /><span>Purge Research History</span></button>
            </div>
          </div>
        </div>
      )}
      <footer className="bg-slate-100 border-t border-slate-200 py-12 no-print text-center">
        <p className="text-slate-500 font-bold uppercase tracking-[0.25em] text-[10px]">Glenn's Tradition Explorer • Pedagogical Research Interface</p>
        <p className="text-slate-400 text-[10px] mt-2 font-medium">Bridging ancient wisdom and modern inquiry through structured comparative ethics.</p>
      </footer>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
