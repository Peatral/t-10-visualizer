import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { db } from './index.js'
import { articles, topics, topicKeywords, articleTopicMatches, categories, trendmapCache, topicsToCategories } from './schema.js'
import { calculateTrendmapGrid } from '../../utils/trendmapCalc.js'
import { getYearHalf } from '../../utils/matching.js'

type NewArticle = typeof articles.$inferInsert

function getSafeFilename(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  const cleanUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 50)
  return `${cleanUrl}_${Math.abs(hash)}`
}

function getSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function seed() {
  console.log('Starting SQLite seeding with topics-based schemas...')

  const publicDir = path.resolve(process.cwd(), 'public')
  const articlesJsonPath = path.join(publicDir, 'articles.json')
  const trendmapJsonPath = path.join(publicDir, 'trendmap.json')
  const articlesDir = path.join(publicDir, 'articles')

  // Create tables and FTS5 virtual table
  const dbPath = path.resolve(process.cwd(), 'sqlite.db')
  const sqlite = new Database(dbPath)
  
  console.log('Creating tables, triggers, and FTS5 virtual tables...')
  sqlite.exec(`
    DROP TABLE IF EXISTS trendmap_cache;
    DROP TABLE IF EXISTS article_topic_matches;
    DROP TABLE IF EXISTS topics_to_categories;
    DROP TABLE IF EXISTS topic_keywords;
    DROP TABLE IF EXISTS topics;
    DROP TABLE IF EXISTS article_keyword_matches;
    DROP TABLE IF EXISTS themenwolke;
    DROP TABLE IF EXISTS translations;
    DROP TRIGGER IF EXISTS articles_ai;
    DROP TRIGGER IF EXISTS articles_ad;
    DROP TRIGGER IF EXISTS articles_au;
    DROP TABLE IF EXISTS articles_fts;
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS categories;

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      link TEXT NOT NULL,
      category_id TEXT,
      category TEXT NOT NULL,
      body_text TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE topics (
      id TEXT PRIMARY KEY,
      name_de TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE topics_to_categories (
      topic_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY(topic_id, category_id),
      FOREIGN KEY(topic_id) REFERENCES topics(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE topic_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      FOREIGN KEY(topic_id) REFERENCES topics(id)
    );

    CREATE TABLE trendmap_cache (
      category TEXT NOT NULL,
      language TEXT NOT NULL,
      result_json TEXT NOT NULL
    );

    CREATE TABLE article_topic_matches (
      article_id TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      bucket TEXT NOT NULL,
      sort_val INTEGER NOT NULL,
      topic_id TEXT NOT NULL,
      FOREIGN KEY(topic_id) REFERENCES topics(id),
      FOREIGN KEY(article_id) REFERENCES articles(id)
    );
    
    CREATE INDEX idx_category_id ON articles(category_id);
    CREATE INDEX idx_date ON articles(date);
    CREATE INDEX idx_topic_cat_topic ON topics_to_categories(topic_id);
    CREATE INDEX idx_topic_cat_cat ON topics_to_categories(category_id);
    CREATE INDEX idx_keywords_topic ON topic_keywords(topic_id);
    CREATE INDEX idx_matches_category ON article_topic_matches(category);
    CREATE INDEX idx_matches_topic ON article_topic_matches(topic_id);
    CREATE INDEX idx_cache_lookup ON trendmap_cache(category, language);

    -- FTS5 Virtual Table for full-text search
    CREATE VIRTUAL TABLE articles_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      body_text
    );

    -- Triggers to keep FTS5 virtual table in sync with articles
    CREATE TRIGGER articles_ai AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(id, title, description, body_text)
      VALUES (new.id, new.title, new.description, new.body_text);
    END;

    CREATE TRIGGER articles_ad AFTER DELETE ON articles BEGIN
      DELETE FROM articles_fts WHERE id = old.id;
    END;

    CREATE TRIGGER articles_au AFTER UPDATE ON articles BEGIN
      DELETE FROM articles_fts WHERE id = old.id;
      INSERT INTO articles_fts(id, title, description, body_text)
      VALUES (new.id, new.title, new.description, new.body_text);
    END;
  `)

  // 1. Seed categories first to satisfy Foreign Key constraints for topics_to_categories junction
  let rawArticles: any[] = []
  if (fs.existsSync(articlesJsonPath)) {
    console.log('Seeding categories...')
    rawArticles = JSON.parse(fs.readFileSync(articlesJsonPath, 'utf8'))
    const uniqueCategoryNames: string[] = Array.from(new Set(rawArticles.map((art: any) => art.category)))
    const categoryEntries = uniqueCategoryNames.map(name => ({
      id: getSlug(name),
      name: name
    }))
    await db.insert(categories).values(categoryEntries).run()
    console.log(`Seeded ${categoryEntries.length} unique categories.`)
  }

  // 2. Seed translations & themenwolke from trendmap.json
  const topicsMap = new Map<string, { id: string, nameDe: string, nameEn: string, categories: Set<string>, keywords: Set<string> }>()

  const SYNONYMS_DICT: Record<string, string[]> = {
    "ki": ["ai", "artificial intelligence", "künstliche intelligenz", "artifical intelligence", "machine learning", "deep learning", "maschinelles lernen"],
    "ai": ["ki", "artificial intelligence", "künstliche intelligenz", "artifical intelligence", "machine learning", "deep learning", "maschinelles lernen"],
    "artificial intelligence": ["ki", "ai", "künstliche intelligenz", "artifical intelligence"],
    "künstliche intelligenz": ["ki", "ai", "artificial intelligence", "artifical intelligence"],
    
    "pv": ["photovoltaik", "photovoltaics", "solar", "solaranlage", "solaranlagen", "solarstrom", "solar power", "balkonkraftwerk", "balkonkraftwerke"],
    "photovoltaik": ["pv", "photovoltaics", "solar", "solaranlage", "solaranlagen", "solarstrom", "solar power"],
    "solar": ["pv", "photovoltaik", "photovoltaics", "solaranlage", "solaranlagen", "solarstrom", "solar power"],
    
    "e-auto": ["elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität", "ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"],
    "elektroauto": ["e-auto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität", "ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"],
    "e-mobilität": ["e-auto", "elektroauto", "elektroautos", "e-mobil", "elektromobilität", "ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"],
    
    "wärmepumpe": ["wärmepumpen", "waermepumpe", "waermepumpen", "heat pump", "heat pumps"],
    "heat pump": ["wärmepumpe", "wärmepumpen", "waermepumpe", "waermepumpen", "heat pumps"],
    
    "windenergie": ["windkraft", "windrad", "windräder", "windkraftanlage", "windkraftanlagen", "wind energy", "wind power", "wind turbine", "wind turbines"],
    "windkraft": ["windenergie", "windrad", "windräder", "windkraftanlage", "windkraftanlagen", "wind energy", "wind power", "wind turbine", "wind turbines"],
    
    "auto": ["pkw", "car", "autos", "pkws", "cars", "personenkraftwagen", "automobil", "automobile", "pkw-maut"],
    "pkw": ["auto", "car", "autos", "pkws", "cars", "personenkraftwagen", "automobil", "automobile"],
    "car": ["auto", "pkw", "autos", "pkws", "cars", "personenkraftwagen", "automobil", "automobile"],
    
    "bus": ["busse", "busses"],
    "busse": ["bus", "busses"],
    "bahn": ["bahnen", "zug", "train", "schienenverkehr", "rail", "railway", "trains", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    "zug": ["bahn", "bahnen", "train", "schienenverkehr", "rail", "railway", "trains", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    "train": ["bahn", "bahnen", "zug", "schienenverkehr", "rail", "railway", "trains", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    "öpnv": ["öffis", "öffentlicher nahverkehr", "public transport", "public transportation"],
    "public transport": ["öpnv", "öffis", "öffentlicher nahverkehr", "public transportation"],
    
    "fahrrad": ["radverkehr", "bike", "bicycle", "e-bike", "velo", "fahrräder", "radeln", "bicycles", "bikes"],
    "bike": ["fahrrad", "radverkehr", "bicycle", "e-bike", "velo", "fahrräder", "radeln", "bicycles", "bikes"],
    
    "wasserstoff": ["h2", "hydrogen", "wasserstoffantrieb", "wasserstofftechnologie", "brennstoffzelle", "brennstoffzellen"],
    "h2": ["wasserstoff", "hydrogen", "wasserstoffantrieb", "wasserstofftechnologie"],
    "hydrogen": ["wasserstoff", "h2", "wasserstoffantrieb", "wasserstofftechnologie"],
    
    "batterie": ["batterien", "akku", "akkus", "akkumulator", "battery", "batteries", "stromspeicher", "energiespeicher", "elektrischer speicher", "chemischer speicher"],
    "battery": ["batterie", "batterien", "akku", "akkus", "battery", "batteries", "stromspeicher", "energiespeicher"],
    
    "kohle": ["braunkohle", "steinkohle", "coal", "kohlekraftwerk", "kohlekraftwerke", "braunkohle-energie"],
    "coal": ["kohle", "braunkohle", "steinkohle", "kohlekraftwerk", "kohlekraftwerke"],
    
    "kernkraft": ["atomkraft", "nuclear", "atomenergie", "kernenergie", "nuclear energy", "nuclear power", "akw", "kkw"],
    "nuclear": ["kernkraft", "atomkraft", "atomenergie", "kernenergie", "nuclear energy", "nuclear power", "akw", "kkw"]
  }

  const CUSTOM_TOPIC_GROUPS: Array<{
    id: string;
    nameDe: string;
    nameEn: string;
    keywords: string[];
  }> = [
    {
      id: "ki",
      nameDe: "KI / Künstliche Intelligenz",
      nameEn: "AI / Artificial Intelligence",
      keywords: ["ki", "ai", "artificial intelligence", "künstliche intelligenz", "artifical intelligence", "machine learning", "deep learning", "maschinelles lernen"]
    },
    {
      id: "pv",
      nameDe: "PV / Photovoltaik",
      nameEn: "PV / Photovoltaics",
      keywords: ["pv", "photovoltaik", "photovoltaics", "solar", "solaranlage", "solaranlagen", "solarstrom", "solar power", "balkonkraftwerk", "balkonkraftwerke"]
    },
    {
      id: "e-mobilitaet",
      nameDe: "E-Mobilität / Elektroautos",
      nameEn: "E-Mobility / Electric Vehicles",
      keywords: ["e-auto", "elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität", "ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"]
    },
    {
      id: "waermepumpe",
      nameDe: "Wärmepumpe",
      nameEn: "Heat pump",
      keywords: ["wärmepumpe", "wärmepumpen", "waermepumpe", "waermepumpen", "heat pump", "heat pumps"]
    },
    {
      id: "windenergie",
      nameDe: "Windenergie / Windkraft",
      nameEn: "Wind energy / Wind power",
      keywords: ["windenergie", "windkraft", "windrad", "windräder", "windkraftanlage", "windkraftanlagen", "wind energy", "wind power", "wind turbine", "wind turbines"]
    },
    {
      id: "auto",
      nameDe: "Auto / PKW",
      nameEn: "Car / Automobile",
      keywords: ["auto", "pkw", "car", "autos", "pkw-maut", "pkws", "cars", "personenkraftwagen", "automobil", "automobile"]
    },
    {
      id: "fahrrad",
      nameDe: "Fahrrad / Radverkehr",
      nameEn: "Bicycle / Cycling",
      keywords: ["fahrrad", "radverkehr", "bike", "bicycle", "e-bike", "velo", "fahrräder", "radeln", "bicycles", "bikes"]
    },
    {
      id: "wasserstoff",
      nameDe: "Wasserstoff",
      nameEn: "Hydrogen",
      keywords: ["wasserstoff", "h2", "hydrogen", "wasserstoffantrieb", "wasserstofftechnologie", "brennstoffzelle", "brennstoffzellen"]
    },
    {
      id: "batterie",
      nameDe: "Batterie / Speicher",
      nameEn: "Battery / Storage",
      keywords: ["batterie", "batterien", "akku", "akkus", "akkumulator", "battery", "batteries", "stromspeicher", "energiespeicher", "elektrischer speicher", "chemischer speicher"]
    },
    {
      id: "kohle",
      nameDe: "Kohleenergie",
      nameEn: "Coal energy",
      keywords: ["kohle", "braunkohle", "steinkohle", "coal", "kohlekraftwerk", "kohlekraftwerke", "braunkohle-energie"]
    },
    {
      id: "kernkraft",
      nameDe: "Kernkraft / Atomkraft",
      nameEn: "Nuclear power / Nuclear energy",
      keywords: ["kernkraft", "atomkraft", "nuclear", "atomenergie", "kernenergie", "nuclear energy", "nuclear power", "akw", "kkw"]
    }
  ]

  function hash(str: string) {
    let h = 0
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i)
      h |= 0
    }
    return h
  }

  function resolveCategoryId(catName: string): string {
    const c = catName.toLowerCase()
    if (c.includes("energy")) return "t-10-energy"
    if (c.includes("food")) return "t-10-food"
    if (c.includes("housing")) return "t-10-housing"
    if (c.includes("mobility")) return "t-10-mobility"
    return getSlug(catName)
  }

  if (fs.existsSync(trendmapJsonPath)) {
    console.log('Parsing translations and themenwolke to build topics...')
    const trendmapData = JSON.parse(fs.readFileSync(trendmapJsonPath, 'utf8'))

    Object.entries(trendmapData.themenwolkeWords || {}).forEach(([cat, words]) => {
      if (!Array.isArray(words)) return

      words.forEach(word => {
        const w = String(word).trim()
        if (!w) return

        let topicId = ""
        let nameDe = ""
        let nameEn = ""
        let keywordsArr: string[] = []

        let matchedGroup = null
        const checkWordLower = w.toLowerCase()
        const transLower = (trendmapData.translations[w] || "").toLowerCase()

        for (const group of CUSTOM_TOPIC_GROUPS) {
          if (group.keywords.includes(checkWordLower) || (transLower && group.keywords.includes(transLower))) {
            matchedGroup = group
            break
          }
        }

        const resolvedCatId = resolveCategoryId(cat)
        let topicCats = new Set<string>()

        if (matchedGroup) {
          topicId = matchedGroup.id
          nameDe = matchedGroup.nameDe
          nameEn = matchedGroup.nameEn
          keywordsArr = [...matchedGroup.keywords]

          // Link custom topics to multiple relevant categories
          if (topicId === "ki") {
            topicCats = new Set(["t-10-mobility", "t-10-energy", "t-10-food", "t-10-housing"])
          } else if (topicId === "pv") {
            topicCats = new Set(["t-10-energy", "t-10-housing"])
          } else if (topicId === "e-mobilitaet") {
            topicCats = new Set(["t-10-mobility", "t-10-energy"])
          } else if (topicId === "waermepumpe") {
            topicCats = new Set(["t-10-energy", "t-10-housing"])
          } else if (topicId === "windenergie") {
            topicCats = new Set(["t-10-energy"])
          } else if (topicId === "auto") {
            topicCats = new Set(["t-10-mobility"])
          } else if (topicId === "fahrrad") {
            topicCats = new Set(["t-10-mobility"])
          } else if (topicId === "wasserstoff") {
            topicCats = new Set(["t-10-energy", "t-10-mobility"])
          } else if (topicId === "batterie") {
            topicCats = new Set(["t-10-energy", "t-10-mobility", "t-10-housing"])
          } else if (topicId === "kohle") {
            topicCats = new Set(["t-10-energy"])
          } else if (topicId === "kernkraft") {
            topicCats = new Set(["t-10-energy"])
          }
        } else {
          // Default topic
          topicId = w.toLowerCase()
            .replace(/ä/g, "ae")
            .replace(/ö/g, "oe")
            .replace(/ü/g, "ue")
            .replace(/ß/g, "ss")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
          
          if (!topicId) {
            topicId = `topic-${Math.abs(hash(w))}`
          }

          nameDe = w
          nameEn = trendmapData.translations[w] || w
          
          keywordsArr = [w.toLowerCase()]
          const trans = trendmapData.translations[w]
          if (trans && trans.toLowerCase() !== w.toLowerCase()) {
            keywordsArr.push(trans.toLowerCase())
          }

          // Merge any other synonyms if matching known terms
          const wordsToCheck = [checkWordLower, transLower].filter(Boolean)
          wordsToCheck.forEach(term => {
            if (SYNONYMS_DICT[term]) {
              SYNONYMS_DICT[term].forEach(syn => {
                if (!keywordsArr.includes(syn)) {
                  keywordsArr.push(syn)
                }
              })
            }
          })

          topicCats = new Set([resolvedCatId])
        }

        const existing = topicsMap.get(topicId)
        if (existing) {
          keywordsArr.forEach(k => existing.keywords.add(k))
          topicCats.forEach(c => existing.categories.add(c))
        } else {
          topicsMap.set(topicId, {
            id: topicId,
            nameDe,
            nameEn,
            categories: topicCats,
            keywords: new Set(keywordsArr)
          })
        }
      })
    })

    const topicsEntries: any[] = []
    const keywordsEntries: any[] = []
    const topicsToCategoriesEntries: any[] = []

    for (const topic of topicsMap.values()) {
      topicsEntries.push({
        id: topic.id,
        nameDe: topic.nameDe,
        nameEn: topic.nameEn,
      })

      for (const kw of topic.keywords) {
        keywordsEntries.push({
          topicId: topic.id,
          keyword: kw,
        })
      }

      for (const catId of topic.categories) {
        topicsToCategoriesEntries.push({
          topicId: topic.id,
          categoryId: catId,
        })
      }
    }

    if (topicsEntries.length > 0) {
      await db.insert(topics).values(topicsEntries).run()
    }
    if (keywordsEntries.length > 0) {
      await db.insert(topicKeywords).values(keywordsEntries).run()
    }
    if (topicsToCategoriesEntries.length > 0) {
      await db.insert(topicsToCategories).values(topicsToCategoriesEntries).run()
    }
    console.log(`Seeded ${topicsEntries.length} topics, ${keywordsEntries.length} topic keywords, and ${topicsToCategoriesEntries.length} topic-category links.`)
  }

  // 3. Seed articles
  if (rawArticles.length > 0) {
    console.log('Seeding articles...')
    let count = 0
    const batchSize = 100
    let currentBatch: Array<NewArticle> = []

    for (const art of rawArticles) {
      const filename = `${getSafeFilename(art.id)}.json`
      const detailPath = path.join(articlesDir, filename)
      let bodyText = ''
      
      if (fs.existsSync(detailPath)) {
        try {
          const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'))
          bodyText = detail.bodyText || ''
        } catch {
          console.warn(`Failed to parse article detail for ${art.id}`)
        }
      }

      currentBatch.push({
        id: art.id,
        title: art.title,
        description: art.description,
        date: art.date,
        link: art.link,
        categoryId: getSlug(art.category),
        category: art.category,
        bodyText: bodyText
      })

      if (currentBatch.length >= batchSize) {
        await db.insert(articles).values(currentBatch).run()
        count += currentBatch.length
        currentBatch = []
      }
    }

    if (currentBatch.length > 0) {
      await db.insert(articles).values(currentBatch).run()
      count += currentBatch.length
    }

    console.log('Matching articles with topics using exact word boundaries...')
    
    const dbArticles = await db.select({
      id: articles.id,
      category: articles.category,
      date: articles.date,
      title: articles.title,
      description: articles.description,
      bodyText: articles.bodyText,
    }).from(articles).all()

    const regexCache = new Map<string, RegExp>()
    function checkSingleMatch(text: string, keyword: string): boolean {
      const lowerWord = keyword.toLowerCase()
      let regex = regexCache.get(lowerWord)
      if (!regex) {
        const escaped = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regex = new RegExp(`(?<![a-zA-Z0-9äöüÄÖÜß])${escaped}(?![a-zA-Z0-9äöüÄÖÜß])`, "i")
        regexCache.set(lowerWord, regex)
      }
      return regex.test(text)
    }

    const matchEntries: any[] = []

    for (const art of dbArticles) {
      const { bucket, sortVal } = getYearHalf(art.date)
      const combinedText = `${art.title} ${art.description} ${art.bodyText}`

      for (const topic of topicsMap.values()) {
        const artCatId = getSlug(art.category)

        if (topic.categories.has(artCatId)) {
          let isMatch = false
          for (const kw of topic.keywords) {
            if (checkSingleMatch(combinedText, kw)) {
              isMatch = true
              break
            }
          }

          if (isMatch) {
            matchEntries.push({
              articleId: art.id,
              category: art.category,
              date: art.date,
              bucket,
              sortVal,
              topicId: topic.id,
            })
          }
        }
      }
    }

    const matchBatchSize = 500
    for (let i = 0; i < matchEntries.length; i += matchBatchSize) {
      const batch = matchEntries.slice(i, i + matchBatchSize)
      await db.insert(articleTopicMatches).values(batch).run()
    }
    console.log(`Successfully populated article_topic_matches with ${matchEntries.length} matches.`)
  }

  // 4. Pre-populate caches for each category
  const categoriesList = await db.select().from(categories).all()
  console.log('Pre-populating trendmapCache table for all categories and languages...')
  for (const cat of categoriesList) {
    // Only pre-calculate trendmaps for the 4 core categories which contain words
    const lower = cat.id.toLowerCase()
    if (lower.includes("energy") || lower.includes("food") || lower.includes("housing") || lower.includes("mobility")) {
      for (const lang of ['en', 'de'] as const) {
        console.log(`Precomputing trendmap grid cache for: "${cat.name}" [${lang}]...`)
        const result = await calculateTrendmapGrid(db, cat.name, lang)
        await db.insert(trendmapCache)
          .values({
            category: cat.name,
            language: lang,
            resultJson: JSON.stringify(result),
          })
          .run()
      }
    }
  }
  console.log('Trendmap cache pre-population complete.')
  console.log('Seeding complete.')
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
