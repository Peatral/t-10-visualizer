import { sqliteTable, text, index, integer, sqliteView } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

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
})

export const translations = sqliteTable('translations', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

// Native Drizzle view declaration using SQL instr operations
export const articleKeywordMatches = sqliteView('article_keyword_matches', {
  articleId: text('article_id').notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  bucket: text('bucket').notNull(),
  sortVal: integer('sort_val').notNull(),
  germanWord: text('german_word').notNull(),
  englishWord: text('english_word').notNull(),
}).as(sql`
  SELECT
    a.id AS article_id,
    a.category AS category,
    a.date AS date,
    (substr(a.date, 1, 4) || '-' || (CASE WHEN substr(a.date, 6, 2) < '07' THEN 'H1' ELSE 'H2' END)) AS bucket,
    (cast(substr(a.date, 1, 4) as integer) * 2 + (CASE WHEN substr(a.date, 6, 2) < '07' THEN 0 ELSE 1 END)) AS sort_val,
    t.word AS german_word,
    coalesce(tr.value, t.word) AS english_word
  FROM articles a
  JOIN themenwolke t ON (a.category LIKE '%' || t.category || '%')
  LEFT JOIN translations tr ON t.word = tr.key
  WHERE instr(lower(a.title || ' ' || a.description || ' ' || a.body_text), lower(t.word)) > 0
     OR (tr.value IS NOT NULL AND instr(lower(a.title || ' ' || a.description || ' ' || a.body_text), lower(tr.value)) > 0)
`)
