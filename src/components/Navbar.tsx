import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Globe, Search, Menu, X } from 'lucide-react'
import { useTranslation } from '../context'

export const Navbar: React.FC = () => {
  const { language, setLanguage, t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="relative bg-[#1e1e1e] border-b border-[#2e2e2e] flex flex-col md:flex-row items-center justify-between px-4 md:px-8 shrink-0 z-40 shadow-lg min-h-[4rem] h-auto md:h-16 py-3.5 md:py-0">
      {/* Brand Header & Toggle */}
      <div className="flex items-center justify-between w-full md:w-auto shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#03a9f4] to-[#3f51b5] flex items-center justify-center font-bold text-white shadow-md shadow-cyan-900/30 font-sans">
            T
          </div>
          <div className="text-left font-sans">
            <h1 className="text-base font-bold text-white tracking-wide m-0 p-0 leading-none">T-10</h1>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Mega Visualizer</span>
          </div>
        </div>

        {/* Burger Button */}
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-gray-400 hover:text-white p-1 hover:bg-[#252525] focus:outline-none transition-colors cursor-pointer"
          title="Toggle Navigation Menu"
        >
          {mobileOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
        </button>
      </div>

      {/* Desktop Links (Hidden on Mobile) */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex gap-1 font-sans">
          <Link 
            to="/" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
          >
            <LayoutDashboard className="w-4 h-4" /> {t('overview')}
          </Link>
          <Link 
            to="/search" 
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
          >
            <Search className="w-4 h-4" /> {t('searchArticles')}
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

      {/* Mobile Links Dropdown Menu (Positioned absolutely to overlay content cleanly) */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[#1e1e1e] border-b border-[#2e2e2e] px-4 pb-4 pt-2 flex flex-col gap-2 shadow-2xl md:hidden">
          <nav className="flex flex-col gap-1 w-full font-sans">
            <Link 
              to="/" 
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
            >
              <LayoutDashboard className="w-4 h-4" /> {t('overview')}
            </Link>
            <Link 
              to="/search" 
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-[#252525] transition-all [&.active]:bg-[#3f51b5] [&.active]:text-white"
            >
              <Search className="w-4 h-4" /> {t('searchArticles')}
            </Link>
          </nav>

          {/* Language Switcher */}
          <button 
            onClick={() => {
              setLanguage(language === 'en' ? 'de' : 'en')
              setMobileOpen(false)
            }}
            className="text-xs font-mono font-bold uppercase text-gray-400 hover:text-white bg-[#252525] hover:bg-[#00bcd4] px-2.5 py-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full mt-2"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'DE' : 'EN'}</span>
          </button>
        </div>
      )}
    </header>
  )
}
export default Navbar
