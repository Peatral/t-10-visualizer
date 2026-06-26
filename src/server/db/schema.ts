import { sqliteTable, text, index, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
})

export const categoriesRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
  topics: many(topicsToCategories),
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
  language: text('language').notNull().default('en'),
}, (table) => [
  index('idx_category_id').on(table.categoryId),
  index('idx_date').on(table.date),
])

export const articlesRelations = relations(articles, ({ one, many }) => ({
  categoryRel: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  topicMatches: many(articleTopicMatches),
}))

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  nameDe: text('name_de').notNull(),
  nameEn: text('name_en').notNull(),
})

export const topicsRelations = relations(topics, ({ many }) => ({
  articleMatches: many(articleTopicMatches),
  keywords: many(topicKeywords),
  categories: many(topicsToCategories),
}))

export const topicsToCategories = sqliteTable('topics_to_categories', {
  topicId: text('topic_id').notNull().references(() => topics.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
}, (table) => [
  primaryKey({ columns: [table.topicId, table.categoryId] }),
  index('idx_topic_cat_topic').on(table.topicId),
  index('idx_topic_cat_cat').on(table.categoryId),
])

export const topicsToCategoriesRelations = relations(topicsToCategories, ({ one }) => ({
  topic: one(topics, {
    fields: [topicsToCategories.topicId],
    references: [topics.id],
  }),
  category: one(categories, {
    fields: [topicsToCategories.categoryId],
    references: [categories.id],
  }),
}))

export const topicKeywords = sqliteTable('topic_keywords', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: text('topic_id').notNull().references(() => topics.id),
  keyword: text('keyword').notNull(),
  language: text('language').notNull(),
}, (table) => [
  index('idx_keywords_topic').on(table.topicId),
])

export const topicKeywordsRelations = relations(topicKeywords, ({ one }) => ({
  topic: one(topics, {
    fields: [topicKeywords.topicId],
    references: [topics.id],
  }),
}))

export const trendmapCache = sqliteTable('trendmap_cache', {
  category: text('category').notNull(),
  language: text('language').notNull(),
  resultJson: text('result_json').notNull(),
}, (table) => [
  index('idx_cache_lookup').on(table.category, table.language),
])

export const articleTopicMatches = sqliteTable('article_topic_matches', {
  articleId: text('article_id').notNull().references(() => articles.id),
  category: text('category').notNull(),
  date: text('date').notNull(),
  bucket: text('bucket').notNull(),
  sortVal: integer('sort_val').notNull(),
  topicId: text('topic_id').notNull().references(() => topics.id),
}, (table) => [
  index('idx_matches_category').on(table.category),
  index('idx_matches_topic').on(table.topicId),
])

export const articleTopicMatchesRelations = relations(articleTopicMatches, ({ one }) => ({
  article: one(articles, {
    fields: [articleTopicMatches.articleId],
    references: [articles.id],
  }),
  topic: one(topics, {
    fields: [articleTopicMatches.topicId],
    references: [topics.id],
  }),
}))
