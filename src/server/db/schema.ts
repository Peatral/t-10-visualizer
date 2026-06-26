import { sqliteTable, text, index, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
})

export const categoriesRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
}))

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  link: text('link').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  category: text('category').notNull(),
  bodyText: text('body_text').notNull(),
}, (table) => [
  index('idx_category_id').on(table.categoryId),
  index('idx_date').on(table.date),
])

export const articlesRelations = relations(articles, ({ one }) => ({
  categoryRel: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
}))

export const themenwolke = sqliteTable('themenwolke', {
  category: text('category').notNull(),
  word: text('word').notNull(),
}, (table) => [
  index('idx_themenwolke_category').on(table.category),
])

export const translations = sqliteTable('translations', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const trendmapCache = sqliteTable('trendmap_cache', {
  category: text('category').notNull(),
  language: text('language').notNull(),
  resultJson: text('result_json').notNull(),
}, (table) => [
  index('idx_cache_lookup').on(table.category, table.language),
])

// Relational matching Table populated at seed time for sub-millisecond query speed
export const articleKeywordMatches = sqliteTable('article_keyword_matches', {
  articleId: text('article_id').notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  bucket: text('bucket').notNull(),
  sortVal: integer('sort_val').notNull(),
  germanWord: text('german_word').notNull(),
  englishWord: text('english_word').notNull(),
}, (table) => [
  index('idx_matches_category').on(table.category),
])
