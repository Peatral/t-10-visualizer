import React from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../utils/trpc';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from '../context';
import { TopicTag } from '../components/TopicTag';
import { CategoryBadge } from '../components/CategoryBadge';
import { PublishedDateBadge } from '../components/PublishedDateBadge';

export const ArticleView: React.FC = () => {
  const { articleId } = useParams({ from: '/article/$articleId' });
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { t } = useTranslation();

  // Fetch article metadata and details
  const { data: articleDetail, isLoading, error } = useQuery(
    trpc.getArticleDetail.queryOptions({ id: articleId })
  );

  // Fetch matched topics
  const { data: topics = [] } = useQuery(
    trpc.getArticleTopics.queryOptions({ id: articleId })
  );

  const handleBack = () => {
    // Go back in history if possible, otherwise default to search or dashboard
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#121212] text-gray-500 gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider uppercase animate-pulse">
          Loading Article...
        </span>
      </div>
    );
  }

  if (error || !articleDetail) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#121212] text-gray-400 p-6 text-center">
        <p className="text-lg font-bold text-red-500 mb-2">Article Not Found</p>
        <p className="text-sm text-gray-500 mb-6">The article with ID "{articleId}" could not be retrieved.</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#3e3e3e] text-white hover:bg-[#323232] transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#121212] overflow-y-auto text-left font-sans select-text">
      {/* Navigation header row */}
      <div className="sticky top-0 bg-[#1e1e1e]/90 backdrop-blur-md border-b border-[#2e2e2e] p-4 flex items-center gap-4 z-10 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#252525] hover:bg-[#323232] border border-[#2e2e2e] text-white font-medium text-xs transition-colors rounded shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <div className="h-4 w-px bg-gray-700" />
        <div className="text-xs text-gray-500 font-semibold font-mono truncate">
          {t('viewingArticle', { id: articleDetail.id })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto p-6 md:p-10 space-y-8 flex-grow">
        {/* Category & Date Metadata Header */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold font-mono">
          <CategoryBadge category={articleDetail.category} variant="large" />
          <PublishedDateBadge date={articleDetail.date} variant="large" />
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight tracking-tight border-b border-[#2e2e2e] pb-6">
          {articleDetail.title}
        </h1>

        {/* Source Link */}
        {articleDetail.link && (
          <div className="pt-2">
            <a
              href={articleDetail.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-semibold text-xs border-b border-cyan-400/30 pb-0.5 hover:border-cyan-300"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {t('source')} {new URL(articleDetail.link).hostname}
            </a>
          </div>
        )}

        {/* Topics List as inline tags below Title */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 pb-2">
            {topics.map((top) => (
              <TopicTag
                key={top.topicId}
                nameDe={top.nameDe}
                nameEn={top.nameEn}
                topicId={top.topicId}
              />
            ))}
          </div>
        )}

        {/* Main Content Area (Single Column) */}
        <div className="space-y-8">
          <p className="text-gray-300 text-sm leading-relaxed">
            {articleDetail.description}
          </p>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-500 border-b border-[#222] pb-1 font-mono">
              {t('fullContent')}
            </h3>
            <div className="text-gray-200 text-sm leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
              {articleDetail.bodyText || 'No full text body available for this article.'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
