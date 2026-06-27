import React from 'react';
import { Calendar } from 'lucide-react';
import { useTranslation } from '../context';

interface PublishedDateBadgeProps {
  date: string;
  variant?: 'large' | 'small';
}

export const PublishedDateBadge: React.FC<PublishedDateBadgeProps> = ({ date, variant = 'small' }) => {
  const { language } = useTranslation();
  
  if (variant === 'large') {
    const formattedDate = new Date(date).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return (
      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold font-mono flex items-center gap-1.5 select-none w-fit">
        <Calendar className="w-3 h-3" />
        {formattedDate}
      </span>
    );
  }

  return (
    <span className="font-mono text-cyan-400 whitespace-nowrap select-none">
      {date}
    </span>
  );
};
