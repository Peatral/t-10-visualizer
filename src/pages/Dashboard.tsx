import React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { TrendingUp, Calendar, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import { StatPanel } from '../components/StatPanel'
import { RecentArticlesFeed } from '../components/RecentArticlesFeed'
import type { Article } from '../types'

export const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const trpcUtils = useTRPC()
  const navigate = useNavigate()

  const { data: dashboardData, isLoading } = useQuery(
    trpcUtils.getDashboardData.queryOptions()
  )

  const handleArticleClick = (art: Article) => {
    navigate({ to: '/article/$articleId', params: { articleId: art.id } })
  }

  if (isLoading || !dashboardData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 bg-[#121212]">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Loading dashboard...</span>
      </div>
    )
  }

  const { totalArticles, categoryCounts, recentArticles } = dashboardData


  return (
    <div className="h-full overflow-y-auto bg-[#121212] select-none text-left font-sans">
      <div className="max-w-6xl mx-auto p-8 space-y-8 pb-16">
        
        {/* Sleek Workspace Header */}
        <div className="pb-6 border-b border-[#222]">
          <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-widest block mb-1">
            {t('overview')}
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">{t('dashboardTitle')}</h2>
          <p className="text-gray-500 text-xs mt-1 font-sans">
            {t('datasetStatus', { count: totalArticles, catCount: Object.keys(categoryCounts).length })}
          </p>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Quick Navigation & Category Status */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
              {t('visualizations')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Heatmap Nav Card */}
              <Link 
                to="/trendmap"
                className="group bg-[#1a1a1a] hover:bg-[#202020] p-6 block transition-colors cursor-pointer relative"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#03a9f4]" />
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-[#03a9f4]/5 text-[#03a9f4] group-hover:bg-[#03a9f4]/10 transition-colors">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">{t('heatmapTitle')}</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-sans">
                  {t('heatmapDesc')}
                </p>
              </Link>

              {/* Timeline Nav Card */}
              <Link 
                to="/timeline"
                className="group bg-[#1a1a1a] hover:bg-[#202020] p-6 block transition-colors cursor-pointer relative"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#3f51b5]" />
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-[#3f51b5]/5 text-[#3f51b5] group-hover:bg-[#3f51b5]/10 transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-base font-bold text-white mb-2">{t('timelineTitle')}</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-sans">
                  {t('timelineDesc')}
                </p>
              </Link>
            </div>

            {/* Recent Documents Feed Component */}
            <RecentArticlesFeed 
              articles={recentArticles} 
              onArticleClick={handleArticleClick} 
            />

          </div>

          {/* Column 3: Stats Panel Component */}
          <StatPanel 
            totalArticles={totalArticles} 
            categoryCounts={categoryCounts} 
          />

        </div>
      </div>
    </div>
  )
}
export default Dashboard
