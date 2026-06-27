import React from 'react';
import { Layers } from 'lucide-react';

interface CategoryBadgeProps {
  category: string;
  variant?: 'large' | 'small';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, variant = 'small' }) => {
  if (variant === 'large') {
    return (
      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold font-mono flex items-center gap-1.5 select-none w-fit">
        <Layers className="w-3 h-3" />
        {category}
      </span>
    );
  }

  return (
    <span className="bg-[#3f51b5]/20 text-indigo-300 px-2 py-0.5 font-semibold text-[10px] font-mono truncate select-none w-fit inline-block">
      {category}
    </span>
  );
};
