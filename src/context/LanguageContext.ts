import { createContext } from 'react'
import type { Language } from './LanguageContextProvider'

export type TranslationKey = 'dashboardTitle' | 'overview' | 'datasetStatus' | 'visualizations' | 'heatmapTitle' | 'heatmapDesc' | 'timelineTitle' | 'timelineDesc' | 'recentArticles' | 'published' | 'category' | 'title' | 'statistics' | 'totalArticles' | 'indexedRecords' | 'categoryDist' | 'detailTitle' | 'source' | 'fullContent' | 'selectArticle' | 'articlesCount' | 'listView' | 'timelineView' | 'heatmapHelp' | 'timelineHelp' | 'timelineGroup' | 'heatmapLabel' | 'totalLabel' | 'categoryLabel' | 'noWords' | 'searchTitle' | 'searchPlaceholder' | 'trendmapSearchPlaceholder' | 'searchArticles' | 'sortBy' | 'newest' | 'oldest' | 'searchFullText' | 'searchEmpty' | 'relativeMode' | 'absoluteMode' | 'relativeModeDesc' | 'smartSearchPlaceholder' | 'searchModifiers' | 'searchHelpNav' | 'modifierCategoryDesc' | 'modifierTopicDesc' | 'modifierAfterDesc' | 'modifierBeforeDesc' | 'modifierSortDesc' | 'viewingArticle'

export interface LanguageContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

export const LanguageContext = createContext<LanguageContextProps | undefined>(undefined)
