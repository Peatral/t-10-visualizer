import React from 'react'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, TrendingUp, Calendar, Globe } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'

export const Navbar: React.FC = () => {
  const { language, setLanguage, t } = useTranslation()

  return (
    <header className="h-16 bg-[#1e1e1e] border-b border-[#2e2e2e] flex items-center justify-between px-8 shrink-0 z-40 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-[#03a9f4] to-[#3f51b5] flex items-center justify-center font-bold text-white shadow-md shadow-cyan-900/30 font-sans">
          T
        </div>
        <div className="text-left font-sans">
          <h1 className="text-base font-bold text-white tracking-wide m-0 p-0 leading-none">T-10</h1>
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Mega Visualizer</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <nav className="flex gap-1 font-sans">
          <Link 
            to="/" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
          >
            <LayoutDashboard className="w-4 h-4" /> {t('overview')}
          </Link>
          <Link 
            to="/trendmap" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
          >
            <TrendingUp className="w-4 h-4" /> {t('heatmapTitle')}
          </Link>
          <Link 
            to="/timeline" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
          >
            <Calendar className="w-4 h-4" /> {t('timelineTitle')}
          </Link>
        </nav>

        {/* Language Selector Toggle */}
        <button 
          onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
          className="text-xs font-mono font-bold uppercase text-gray-400 hover:text-white bg-[#252525] hover:bg-[#00bcd4] px-2.5 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'DE' : 'EN'}</span>
        </button>
      </div>
    </header>
  )
}
export default Navbar
