
export type Tradition = 
  | 'Fundamentalist Christianity'
  | 'Judaism'
  | 'Stoicism'
  | 'Mainstream Christianity'
  | 'Catholicism'
  | 'Islam'
  | 'Humanism'
  | 'Buddhism'
  | 'Taoism'
  | 'Hinduism';

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

export interface AppState {
  history: ComparisonResult[];
  currentResult: ComparisonResult | null;
  isLoading: boolean;
  systemPrompt: string;
}
