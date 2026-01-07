
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from './Icons';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  children, 
  defaultOpen = true 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">
          {title}
        </h3>
        <span className="section-header-icon">
          {isOpen ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
        </span>
      </button>
      <div 
        className={`collapsible-content overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-height-none border-t border-slate-200' : 'max-h-0'
        }`}
      >
        <div className="p-4 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};
