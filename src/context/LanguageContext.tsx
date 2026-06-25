import React, { createContext, useState, useContext } from 'react'

export type Language = 'en' | 'de'

const translations = {
  en: {
    dashboardTitle: "T-10 Analytics Dashboard",
    overview: "Overview",
    datasetStatus: "Dataset status: Loaded {count} articles across {catCount} categories.",
    visualizations: "Visualizations",
    heatmapTitle: "Topic Trend Heatmap",
    heatmapDesc: "Map terminologies across time buckets. Detect emerging keywords, peak phases, and trends using color densities.",
    timelineTitle: "Timeline Explorer",
    timelineDesc: "Interactive horizontal axis mapping developments chronologically. Filter by topic clusters and view raw contents.",
    recentArticles: "Recent Articles",
    published: "Published",
    category: "Category",
    title: "Title",
    statistics: "Statistics",
    totalArticles: "Total Articles",
    indexedRecords: "Indexed article records",
    categoryDist: "Category Distribution",
    detailTitle: "Article Details",
    source: "Source:",
    fullContent: "Full Article Content",
    selectArticle: "Select an article to view details.",
    articlesCount: "Articles ({count})",
    listView: "List",
    timelineView: "Timeline",
    heatmapHelp: "Showing top {count} matching terms. Click any active cell to view articles.",
    timelineHelp: "Zoom with mouse wheel, drag horizontally to scroll. Click events to view article bodies.",
    timelineGroup: "Timeline Group:",
    heatmapLabel: "Topic / Keyword",
    totalLabel: "Total",
    categoryLabel: "Category:",
    noWords: "No matching vocabulary words found in the article database for this category.",
    searchTitle: "Article Search Engine",
    searchPlaceholder: "Search by title, description, or content...",
    searchArticles: "Search",
    sortBy: "Sort By",
    newest: "Newest First",
    oldest: "Oldest First",
    searchFullText: "Search Full Text (Body)",
    searchEmpty: "No articles matched your search query."
  },
  de: {
    dashboardTitle: "T-10 Analyse-Dashboard",
    overview: "Übersicht",
    datasetStatus: "Datensatzstatus: {count} Artikel in {catCount} Kategorien geladen.",
    visualizations: "Visualisierungen",
    heatmapTitle: "Themen-Trend-Heatmap",
    heatmapDesc: "Begrifflichkeiten über Zeitabschnitte hinweg abbilden. Erkennen Sie aufkommende Keywords, Spitzenphasen und Trends anhand von Farbdichten.",
    timelineTitle: "Timeline-Explorer",
    timelineDesc: "Interaktive horizontale Achse, die Entwicklungen chronologisch darstellt. Filtern Sie nach Themenclustern und betrachten Sie Rohinhalte.",
    recentArticles: "Neueste Artikel",
    published: "Veröffentlicht",
    category: "Kategorie",
    title: "Titel",
    statistics: "Statistiken",
    totalArticles: "Artikel Gesamt",
    indexedRecords: "Indizierte Artikeldatensätze",
    categoryDist: "Kategorieverteilung",
    detailTitle: "Artikel-Details",
    source: "Quelle:",
    fullContent: "Vollständiger Artikelinhalt",
    selectArticle: "Wählen Sie einen Artikel aus, um Details anzuzeigen.",
    articlesCount: "Artikel ({count})",
    listView: "Liste",
    timelineView: "Zeitachse",
    heatmapHelp: "Zeigt die besten {count} passenden Begriffe. Klicken Sie auf eine aktive Zelle, um Artikel anzuzeigen.",
    timelineHelp: "Zoomen Sie mit dem Mausrad, ziehen Sie horizontal zum Scrollen. Klicken Sie auf Ereignisse, um Artikel anzuzeigen.",
    timelineGroup: "Timeline-Gruppe:",
    heatmapLabel: "Thema / Keyword",
    totalLabel: "Gesamt",
    categoryLabel: "Kategorie:",
    noWords: "Keine passenden Vokabeln in der Artikeldatenbank für diese Kategorie gefunden.",
    searchTitle: "Artikel-Suchmaschine",
    searchPlaceholder: "Suche nach Titel, Beschreibung oder Inhalt...",
    searchArticles: "Suche",
    sortBy: "Sortieren nach",
    newest: "Neueste zuerst",
    oldest: "Älteste zuerst",
    searchFullText: "Volltext durchsuchen (Inhalt)",
    searchEmpty: "Keine Artikel entsprechen Ihrer Suchanfrage."
  }
}

type TranslationKey = keyof typeof translations.en

interface LanguageContextProps {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en')

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations['en'][key] || ''
    if (params) {
      Object.entries(params).forEach(([pKey, pVal]) => {
        text = text.replace(`{${pKey}}`, String(pVal))
      })
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useTranslation = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
