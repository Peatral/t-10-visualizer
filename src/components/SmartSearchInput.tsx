import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useTRPC } from '../utils/trpc';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../context';
import { SEARCH_MODIFIERS } from '../utils/searchParser';
import type { ModifierKey, SuggestionItem } from '../utils/searchParser';

interface SmartSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  categories: string[];
}

export const SmartSearchInput: React.FC<SmartSearchInputProps> = ({
  value,
  onChange,
  categories,
}) => {
  const trpc = useTRPC();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch topics list for autocomplete
  const { data: topics = [] } = useQuery(trpc.getAllTopics.queryOptions());

  // Detect which suggestions to show based on input cursor position and string
  const suggestions = useMemo<SuggestionItem[]>(() => {
    if (!inputRef.current) return [];
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    
    // Find the word/filter we are currently typing
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';

    // Check if we are currently typing a value inside a filter (e.g. category:mo)
    const filterValueMatch = currentWord.match(/^([a-zA-Z-]+):(.*)/i);

    if (filterValueMatch) {
      const filterKey = filterValueMatch[1].toLowerCase() as ModifierKey;
      const filterVal = filterValueMatch[2].toLowerCase();

      const modifier = SEARCH_MODIFIERS.find(m => m.key === filterKey);
      if (modifier && modifier.getValues) {
        return modifier.getValues(filterVal, { categories, topics });
      }
    }

    // Default: suggest filter keys (category:, topic:, after:, before:, sort:)
    const searchStr = currentWord.toLowerCase();
    return SEARCH_MODIFIERS
      .filter(m => `${m.key}:`.startsWith(searchStr))
      .map(m => ({
        type: 'filter',
        key: m.key,
        label: `${m.key}:`,
        sublabel: t(m.sublabelKey),
        insertText: m.insertText,
        icon: m.icon("w-3.5 h-3.5 text-gray-400")
      }));
  }, [value, categories, topics, t]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Autocomplete function
  const applySuggestion = (item: SuggestionItem) => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    let newTextBefore = '';
    if (item.type === 'filter') {
      // Replace last typing word with the filter token
      words[words.length - 1] = item.insertText;
      newTextBefore = words.join(' ');
    } else {
      // Replace after the colon
      const colonIndex = lastWord.indexOf(':');
      if (colonIndex !== -1) {
        words[words.length - 1] = lastWord.slice(0, colonIndex + 1) + item.insertText;
      } else {
        words[words.length - 1] = `${item.key}:${item.insertText}`;
      }
      newTextBefore = words.join(' ') + ' '; // Add space after value to start next search token
    }

    const finalVal = newTextBefore + textAfterCursor;
    onChange(finalVal);

    // Keep focus and position cursor correctly
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = newTextBefore.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applySuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('smartSearchPlaceholder')}
          className="w-full bg-[#1e1e1e] border border-[#2e2e2e] text-white px-3.5 py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-gray-500 transition-colors shadow-inner"
        />
        <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5 pointer-events-none" />
        {value && (
          <button
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 top-3.5 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-[#181818]/95 backdrop-blur-md border border-[#2e2e2e] shadow-2xl z-50 max-h-72 overflow-y-auto font-sans text-xs divide-y divide-[#242424]">
          <div className="px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider bg-[#131313] flex justify-between select-none">
            <span>{t('searchModifiers')}</span>
            <span>{t('searchHelpNav')}</span>
          </div>
          <div className="p-1 space-y-0.5">
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.key}-${item.label}-${idx}`}
                  onClick={() => {
                    applySuggestion(item);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#03a9f4]/25 text-white' : 'text-gray-300 hover:bg-[#202020]'
                  }`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  <div className="flex-grow min-w-0">
                    <span className="font-bold font-mono text-cyan-400">{item.label}</span>
                    {item.sublabel && (
                      <span className="ml-2 text-gray-500 text-[10px] truncate">{item.sublabel}</span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] text-cyan-400 font-bold bg-[#03a9f4]/15 px-1.5 py-0.5 font-mono select-none">
                      TAB
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
