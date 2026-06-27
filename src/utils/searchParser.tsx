import React from 'react';
import { Layers, MessageSquare, Calendar, Shuffle } from 'lucide-react';
import type { TranslationKey } from '../context/LanguageContext';

export type ModifierKey = 'category' | 'topic' | 'before' | 'after' | 'sort';

export interface SuggestionItem {
  type: 'filter' | 'value';
  key: string;
  label: string;
  sublabel?: string;
  insertText: string;
  icon?: React.ReactNode;
}

export interface ModifierDefinition {
  key: ModifierKey;
  sublabelKey: TranslationKey;
  insertText: string;
  icon: (className: string) => React.ReactNode;
  getValues?: (val: string, context: { categories: string[]; topics: any[] }) => SuggestionItem[];
}

export const SEARCH_MODIFIERS: ModifierDefinition[] = [
  {
    key: 'category',
    sublabelKey: 'modifierCategoryDesc',
    insertText: 'category:',
    icon: (cls) => <Layers className={cls} />,
    getValues: (val, { categories }) => {
      const list = ['All', ...categories];
      return list
        .filter(cat => cat.toLowerCase().includes(val))
        .map(cat => ({
          type: 'value',
          key: 'category',
          label: cat,
          insertText: cat.includes(' ') ? `"${cat}"` : cat,
          icon: <Layers className="w-3.5 h-3.5 text-indigo-400" />
        }));
    }
  },
  {
    key: 'topic',
    sublabelKey: 'modifierTopicDesc',
    insertText: 'topic:',
    icon: (cls) => <MessageSquare className={cls} />,
    getValues: (val, { topics }) => {
      return topics
        .filter(top => 
          top.id.toLowerCase().includes(val) || 
          top.nameDe.toLowerCase().includes(val) || 
          top.nameEn.toLowerCase().includes(val)
        )
        .slice(0, 10)
        .map(top => ({
          type: 'value',
          key: 'topic',
          label: top.nameEn,
          sublabel: top.nameDe,
          insertText: top.id,
          icon: <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
        }));
    }
  },
  {
    key: 'after',
    sublabelKey: 'modifierAfterDesc',
    insertText: 'after:',
    icon: (cls) => <Calendar className={cls} />,
    getValues: (val, _) => [
      {
        type: 'value',
        key: 'after',
        label: 'YYYY-MM-DD',
        sublabel: val || 'e.g. 2025-06-30',
        insertText: '2025-06-30',
        icon: <Calendar className="w-3.5 h-3.5 text-amber-400" />
      }
    ]
  },
  {
    key: 'before',
    sublabelKey: 'modifierBeforeDesc',
    insertText: 'before:',
    icon: (cls) => <Calendar className={cls} />,
    getValues: (val, _) => [
      {
        type: 'value',
        key: 'before',
        label: 'YYYY-MM-DD',
        sublabel: val || 'e.g. 2025-06-30',
        insertText: '2025-06-30',
        icon: <Calendar className="w-3.5 h-3.5 text-amber-400" />
      }
    ]
  },
  {
    key: 'sort',
    sublabelKey: 'modifierSortDesc',
    insertText: 'sort:',
    icon: (cls) => <Shuffle className={cls} />,
    getValues: (val, _) => {
      return ['newest', 'oldest']
        .filter(s => s.startsWith(val))
        .map(s => ({
          type: 'value',
          key: 'sort',
          label: s === 'newest' ? 'Newest First' : 'Oldest First',
          insertText: s,
          icon: <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
        }));
    }
  }
];

export interface ParsedSearchQuery {
  q: string;
  category?: string;
  topic?: string;
  before?: string;
  after?: string;
  sort?: 'newest' | 'oldest';
}

export function parseSearchQuery(queryStr: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = { q: '' };
  if (!queryStr) return result;

  const keysStr = SEARCH_MODIFIERS.map(m => m.key).join('|');
  // Regex to match key:value, key:"value with spaces", or key:'value with spaces'
  const filterRegex = new RegExp(`\\b(${keysStr}):(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'gi');
  
  let match;
  let lastIndex = 0;
  const cleanParts: string[] = [];
  
  while ((match = filterRegex.exec(queryStr)) !== null) {
    const key = match[1].toLowerCase() as ModifierKey;
    const val = match[2] || match[3] || match[4];
    
    // Add text before this match to cleanParts
    const textBefore = queryStr.slice(lastIndex, match.index).trim();
    if (textBefore) {
      cleanParts.push(textBefore);
    }
    
    if (key === 'sort') {
      const lowerVal = val.toLowerCase();
      if (lowerVal === 'oldest' || lowerVal === 'newest') {
        result.sort = lowerVal as 'newest' | 'oldest';
      }
    } else {
      result[key] = val;
    }
    
    lastIndex = filterRegex.lastIndex;
  }
  
  // Add remaining text after last match
  const remainingText = queryStr.slice(lastIndex).trim();
  if (remainingText) {
    cleanParts.push(remainingText);
  }
  
  result.q = cleanParts.join(' ').trim();
  return result;
}

export function stringifySearchQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = [];
  if (parsed.q) {
    parts.push(parsed.q);
  }

  for (const modifier of SEARCH_MODIFIERS) {
    const val = parsed[modifier.key];
    if (val) {
      const cleanVal = val.includes(' ') ? `"${val}"` : val;
      parts.push(`${modifier.key}:${cleanVal}`);
    }
  }

  return parts.join(' ');
}
