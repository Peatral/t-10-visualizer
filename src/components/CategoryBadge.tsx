import React from 'react';
import { Layers } from 'lucide-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { parseSearchQuery, stringifySearchQuery } from '../utils/searchParser';

interface CategoryBadgeProps {
  category: string;
  variant?: 'large' | 'small';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, variant = 'small' }) => {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as any;
  const currentQ = searchParams?.q || '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent row selection clicks
    const parsed = parseSearchQuery(currentQ);
    parsed.category = category;
    const newQ = stringifySearchQuery(parsed);
    navigate({
      to: '/search',
      search: { q: newQ, view: searchParams?.view || 'list' }
    });
  };

  if (variant === 'large') {
    return (
      <span 
        onClick={handleClick}
        className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold font-mono flex items-center gap-1.5 select-none w-fit cursor-pointer hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
      >
        <Layers className="w-3 h-3" />
        {category}
      </span>
    );
  }

  return (
    <span 
      onClick={handleClick}
      className="bg-[#3f51b5]/20 text-indigo-300 px-2 py-0.5 font-semibold text-[10px] font-mono truncate select-none w-fit inline-block cursor-pointer hover:bg-[#3f51b5]/30 hover:text-white transition-colors"
    >
      {category}
    </span>
  );
};
