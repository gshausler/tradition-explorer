
import { Tradition } from './types';

export const TRADITIONS: Tradition[] = [
  'Fundamentalist Christianity',
  'Judaism',
  'Stoicism',
  'Mainstream Christianity',
  'Catholicism',
  'Islam',
  'Humanism',
  'Buddhism',
  'Taoism',
  'Hinduism'
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
