import React, { useState, useEffect, useRef } from 'react';
import { AppState, Tradition, ComparisonResult, SectionKey } from './types';
import { TRADITIONS, SECTION_LABELS, DEFAULT_SYSTEM_PROMPT, EXAMPLE_QUERIES } from './constants';
import { generateComparison } from './services/gemini';
import { CollapsibleSection } from './components/CollapsibleSection';
import { Trash, Download, History, Settings, ChevronDown } from './components/Icons';

declare var html2pdf: any;

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

  useEffect(() => {
    localStorage.setItem('comparison_history', JSON.stringify(history));
  }, [history]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueQuestions: string[] = Array.from(new Set(history.map(h => h.question)));

  const handleToggleTradition = (tradition: Tradition) => {
    if (selectedTraditions.includes(tradition)) {
      setSelectedTraditions(selectedTraditions.filter(t => t !== tradition));
    } else if (selectedTraditions.length < 3) {
      setSelectedTraditions([...selectedTraditions, tradition]);
    }
  };

  const handleSelectExample = (example: string) => {
    setQuestion(example);
    setShowExamples(false);
    // Smooth scroll to the top of the input area if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = async () => {
    if (!question || selectedTraditions.length === 0) return;
    
    setIsLoading(true);
    setIsDropdownOpen(false);
    try {
      const result = await generateComparison(question, selectedTraditions, systemPrompt);
      setCurrentResult(result);
      setHistory(prev => [result, ...prev]);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("An error occurred during generation. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to delete all history?")) {
      setHistory([]);
      setCurrentResult(null);
      setIsDropdownOpen(false);
    }
  };

  const handleReport = async () => {
    if (!resultsRef.current || !currentResult) return;

    const element = resultsRef.current;
    const fileName = `Glenns_Tradition_Explorer_${currentResult.question.substring(0, 30).trim().replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4], 
      filename:     fileName,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        scrollY: 0, 
        scrollX: 0,
        windowWidth: 1024 
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    document.body.classList.add('pdf-export');
    
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF generation failed:", error);
      window.print();
    } finally {
      setTimeout(() => {
        document.body.classList.remove('pdf-export');
      }, 1000);
    }
  };

  const loadFromHistory = (result: ComparisonResult) => {
    setCurrentResult(result);
    setQuestion(result.question);
    setSelectedTraditions(result.selectedTraditions);
    setShowHistory(false);
    setIsDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectPreviousQuestion = (q: string) => {
    setQuestion(q);
    setIsDropdownOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <History className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Glenn's Tradition Explorer</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all"
              title="System Settings"
            >
              <Settings />
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
            {currentResult && (
              <button 
                onClick={handleReport}
                className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Report</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Input Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 no-print">
          <div className="mb-6 relative" ref={dropdownRef}>
            <label htmlFor="question" className="block text-sm font-semibold text-slate-700 mb-2">
              What would you like to explore?
            </label>
            <div className="relative">
              <input
                id="question"
                type="text"
                autoComplete="off"
                className="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-all outline-none"
                placeholder='e.g., "The nature of mercy" or "Approach to suffering"'
                value={question}
                onFocus={() => uniqueQuestions.length > 0 && setIsDropdownOpen(true)}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (uniqueQuestions.length > 0) setIsDropdownOpen(true);
                }}
              />
              {uniqueQuestions.length > 0 && (
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className={`transform transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Dropdown for previous questions */}
            {isDropdownOpen && uniqueQuestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Recent Queries</span>
                </div>
                {uniqueQuestions
                  .filter((q: string) => q.toLowerCase().includes(question.toLowerCase()))
                  .map((q: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => selectPreviousQuestion(q)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center space-x-2"
                    >
                      <History className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                {uniqueQuestions.filter((q: string) => q.toLowerCase().includes(question.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400 italic">No matching history</div>
                )}
              </div>
            )}
          </div>

          {/* Examples Toggle Section */}
          <div className="mb-6">
            <button 
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg"
            >
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mr-1">NEW</span>
              <span>Need inspiration? View scholarly examples</span>
              <ChevronDown className={`w-4 h-4 transform transition-transform ${showExamples ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-hidden transition-all duration-300 ${showExamples ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {EXAMPLE_QUERIES.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectExample(example)}
                  className="text-left p-3 text-xs bg-slate-50 border border-slate-100 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-slate-600 leading-snug shadow-sm"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select 1 to 3 traditions for analysis:
            </label>
            <div className="flex flex-wrap gap-2">
              {TRADITIONS.map((tradition) => (
                <button
                  key={tradition}
                  onClick={() => handleToggleTradition(tradition)}
                  disabled={!selectedTraditions.includes(tradition) && selectedTraditions.length >= 3}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedTraditions.includes(tradition)
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 ring-offset-1'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {tradition}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">
                {selectedTraditions.length} tradition{selectedTraditions.length !== 1 ? 's' : ''} selected
              </p>
              {selectedTraditions.length > 0 && (
                <button 
                  onClick={() => setSelectedTraditions([])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Clear selection
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleGenerate}
              disabled={isLoading || !question || selectedTraditions.length === 0}
              className={`px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Consulting Wisdom...</span>
                </>
              ) : (
                <span>Generate Analysis</span>
              )}
            </button>
          </div>
        </div>

        {/* System Prompt Modal Overlay */}
        {showSystemPrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800">System Instruction</h2>
                <button onClick={() => setShowSystemPrompt(false)} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <textarea
                className="w-full h-64 p-4 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
              <div className="mt-4 flex justify-end space-x-2">
                <button 
                  onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  Reset to Default
                </button>
                <button 
                  onClick={() => setShowSystemPrompt(false)}
                  className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Area */}
        <div id="results-display" ref={resultsRef} className="space-y-6 bg-white p-0">
          {currentResult ? (
            <div className="p-0 m-0">
              {/* Report Header (Print/PDF only) */}
              <div className="hidden print-only pdf-show pdf-title-block mb-8 border-b-2 border-slate-900 pb-4">
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', margin: 0, padding: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'left', padding: 0, verticalAlign: 'top' }}>
                        <p className="text-xs font-bold text-indigo-600 tracking-widest uppercase mb-1">Scholarly Tradition Analysis</p>
                        <h1 className="text-3xl font-bold serif text-slate-900 leading-tight">
                          {currentResult.question}
                        </h1>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex items-center space-x-4 text-sm text-slate-600 italic mt-4">
                  <span>Tradition{currentResult.selectedTraditions.length > 1 ? 's' : ''}: {currentResult.selectedTraditions.join(', ')}</span>
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                  <span>Date: {new Date(currentResult.timestamp).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Analysis Sections */}
              {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
                <CollapsibleSection 
                  key={`${currentResult.id}-${key}`} 
                  title={SECTION_LABELS[key]}
                  defaultOpen={key === 'summary'}
                >
                  <div className={`grid grid-cols-1 ${currentResult.selectedTraditions.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : ''} gap-6`}>
                    {currentResult.selectedTraditions.map((tradition) => (
                      <div key={tradition} className="flex flex-col h-full bg-slate-50/50 rounded-lg p-4 border border-slate-100">
                        <h4 className="font-bold text-indigo-900 border-b border-indigo-100 pb-2 mb-3 text-sm tracking-wider uppercase">
                          {tradition}
                        </h4>
                        <div className="prose prose-sm text-slate-700 leading-relaxed whitespace-pre-wrap text-left">
                          {currentResult.data[key][tradition] || "No data provided for this perspective."}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          ) : (
            !isLoading && (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 no-print">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-900">No active comparison</h3>
                <p className="text-slate-500 mt-2">Enter a question or choose an example above to begin your scholarly exploration.</p>
              </div>
            )
          )}
        </div>
      </main>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-[70] overflow-hidden no-print">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <History className="mr-2" />
                Query History
              </h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {history.length > 0 ? (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                  >
                    <p className="font-semibold text-slate-800 line-clamp-2 mb-2 group-hover:text-indigo-700">
                      {item.question}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.selectedTraditions.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-100 text-[10px] rounded text-slate-600 uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-400 italic">History is currently empty.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200">
              <button
                onClick={clearHistory}
                disabled={history.length === 0}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-all disabled:opacity-50"
              >
                <Trash className="w-4 h-4" />
                <span>Clear All History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-8 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-500 text-sm">
            Powered by Gemini Pro & Advanced Ethics Research Models
          </p>
          <p className="text-slate-400 text-xs mt-1">
            © {new Date().getFullYear()} Glenn's Tradition Explorer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;