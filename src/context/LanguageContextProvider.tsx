import React, { useState } from 'react'
import { LanguageContext } from './LanguageContext'
import type { TranslationKey } from './LanguageContext'

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
    heatmapView: "Heatmap",
    heatmapHelp: "Click any active cell, keyword row, or column header to view articles.",
    timelineHelp: "Zoom with mouse wheel, drag horizontally to scroll. Click events to view article bodies.",
    timelineGroup: "Timeline Group:",
    heatmapLabel: "Topic / Keyword",
    totalLabel: "Total",
    categoryLabel: "Category:",
    noWords: "No matching vocabulary words found in the article database for this category.",
    searchTitle: "Article Search Engine",
    searchPlaceholder: "Search by title, description, or content...",
    trendmapSearchPlaceholder: "Search by topic or keyword...",
    searchArticles: "Search",
    sortBy: "Sort By",
    newest: "Newest First",
    oldest: "Oldest First",
    searchFullText: "Search Full Text (Body)",
    searchEmpty: "No articles matched your search query.",
    relativeMode: "Relative Mode",
    absoluteMode: "Absolute Mode",
    relativeModeDesc: "Shows keyword mentions weighted against total articles in each period (using gaussian smoothing to stabilize low-data eras).",
    smartSearchPlaceholder: "Search articles... (e.g. charging category:mobility after:2025-01-01 topic:ki)",
    searchModifiers: "Search Modifiers",
    searchHelpNav: "Use ↑↓ to navigate, Enter to select",
    modifierCategoryDesc: "Filter by category",
    modifierTopicDesc: "Filter by topic keyword",
    modifierAfterDesc: "Show articles published after date (YYYY-MM-DD)",
    modifierBeforeDesc: "Show articles published before date (YYYY-MM-DD)",
    modifierSortDesc: "Sort order (newest, oldest)",
    viewingArticle: "Viewing Article: {id}"
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
    detailTitle: "Article-Details",
    source: "Quelle:",
    fullContent: "Vollständiger Artikelinhalt",
    selectArticle: "Wählen Sie einen Artikel aus, um Details anzuzeigen.",
    articlesCount: "Artikel ({count})",
    listView: "Liste",
    timelineView: "Zeitachse",
    heatmapHelp: "Klicken Sie auf eine aktive Zelle, Keyword-Zeile oder Spaltenüberschrift, um Artikel anzuzeigen.",
    timelineHelp: "Zoomen Sie mit dem Mausrad, ziehen Sie horizontal zum Scrollen. Klicken Sie auf Ereignisse, um Artikel anzuzeigen.",
    timelineGroup: "Timeline-Gruppe:",
    heatmapLabel: "Thema / Keyword",
    totalLabel: "Gesamt",
    categoryLabel: "Kategorie:",
    noWords: "Keine passenden Vokabeln in der Artikeldatenbank für diese Kategorie gefunden.",
    searchTitle: "Artikel-Suchmaschine",
    searchPlaceholder: "Suche nach Titel, Beschreibung oder Inhalt...",
    trendmapSearchPlaceholder: "Suche nach Thema oder Stichwort...",
    searchArticles: "Suche",
    sortBy: "Sortieren nach",
    newest: "Neueste zuerst",
    oldest: "Älteste zuerst",
    searchFullText: "Volltext durchsuchen (Inhalt)",
    searchEmpty: "Keine Artikel entsprechen Ihrer Suchanfrage.",
    relativeMode: "Relativer Modus",
    absoluteMode: "Absoluter Modus",
    relativeModeDesc: "Zeigt Keyword-Nennungen im Verhältnis zur Gesamtzahl der Artikel in dem Zeitraum (mit Gauß-Glättung zur Stabilisierung datenarmem Ären).",
    smartSearchPlaceholder: "Artikel suchen... (z. B. Ladeinfrastruktur category:mobility after:2025-01-01 topic:ki)",
    searchModifiers: "Suchmodifikatoren",
    searchHelpNav: "Verwenden Sie ↑↓ zum Navigieren, Enter zum Auswählen",
    modifierCategoryDesc: "Nach Kategorie filtern",
    modifierTopicDesc: "Nach Themenschlüsselwort filtern",
    modifierAfterDesc: "Artikel nach Datum anzeigen (JJJJ-MM-TT)",
    modifierBeforeDesc: "Artikel vor Datum anzeigen (JJJJ-MM-TT)",
    modifierSortDesc: "Sortierreihenfolge (newest, oldest)",
    viewingArticle: "Artikel anzeigen: {id}",
    heatmapView: "Heatmap",
  }
}

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
