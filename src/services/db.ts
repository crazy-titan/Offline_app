import * as SQLite from 'expo-sqlite';

export interface Snippet {
  id: number;
  title: string;
  code: string;
  language: string;
  tags: string[]; // Stored as JSON string in SQLite
  is_favorite: boolean; // Stored as 0 or 1 in SQLite
  explanation: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  snippet_id: number;
  file_path: string;
  file_name: string;
  mime_type: string | null;
}

// Open the database synchronously
const db = SQLite.openDatabaseSync('snippets.db');

/**
 * Initializes the database tables if they do not exist.
 */
export async function initDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      tags TEXT NOT NULL, -- JSON string array: e.g. '["react","state"]'
      is_favorite INTEGER NOT NULL DEFAULT 0,
      explanation TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snippet_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      FOREIGN KEY(snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Formats a raw row from the database into a Snippet object.
 */
function formatSnippetRow(row: any): Snippet {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch (e) {
    tags = [];
  }
  return {
    ...row,
    tags,
    is_favorite: row.is_favorite === 1,
  };
}

/**
 * Create a new snippet in the database.
 */
export async function createSnippet(
  title: string,
  code: string,
  language: string,
  tags: string[],
  isFavorite: boolean = false,
  explanation: string | null = null
): Promise<Snippet> {
  const now = new Date().toISOString();
  const tagsStr = JSON.stringify(tags);
  const favInt = isFavorite ? 1 : 0;

  const result = await db.runAsync(
    `INSERT INTO snippets (title, code, language, tags, is_favorite, explanation, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, code, language.toLowerCase(), tagsStr, favInt, explanation, now, now]
  );

  return {
    id: result.lastInsertRowId,
    title,
    code,
    language: language.toLowerCase(),
    tags,
    is_favorite: isFavorite,
    explanation,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update an existing snippet.
 */
export async function updateSnippet(
  id: number,
  title: string,
  code: string,
  language: string,
  tags: string[],
  isFavorite: boolean,
  explanation: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const tagsStr = JSON.stringify(tags);
  const favInt = isFavorite ? 1 : 0;

  await db.runAsync(
    `UPDATE snippets 
     SET title = ?, code = ?, language = ?, tags = ?, is_favorite = ?, explanation = ?, updated_at = ?
     WHERE id = ?`,
    [title, code, language.toLowerCase(), tagsStr, favInt, explanation, now, id]
  );
}

/**
 * Update the AI explanation for a snippet.
 */
export async function updateSnippetExplanation(id: number, explanation: string | null): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE snippets SET explanation = ?, updated_at = ? WHERE id = ?`,
    [explanation, now, id]
  );
}

/**
 * Delete a snippet.
 */
export async function deleteSnippet(id: number): Promise<void> {
  await db.runAsync(`DELETE FROM snippets WHERE id = ?`, [id]);
}

/**
 * Get a snippet by ID.
 */
export async function getSnippet(id: number): Promise<Snippet | null> {
  const row = await db.getFirstAsync(`SELECT * FROM snippets WHERE id = ?`, [id]);
  if (!row) return null;
  return formatSnippetRow(row);
}

/**
 * Get all snippets ordered by newest first.
 */
export async function getAllSnippets(): Promise<Snippet[]> {
  const rows = await db.getAllAsync(`SELECT * FROM snippets ORDER BY created_at DESC`);
  return rows.map(formatSnippetRow);
}

/**
 * Get all favorite snippets.
 */
export async function getFavoriteSnippets(): Promise<Snippet[]> {
  const rows = await db.getAllAsync(`SELECT * FROM snippets WHERE is_favorite = 1 ORDER BY created_at DESC`);
  return rows.map(formatSnippetRow);
}

/**
 * Toggle favorite status.
 */
export async function toggleFavorite(id: number, isFavorite: boolean): Promise<void> {
  const favInt = isFavorite ? 1 : 0;
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE snippets SET is_favorite = ?, updated_at = ? WHERE id = ?`,
    [favInt, now, id]
  );
}

/**
 * Search snippets by title, code, language, or tags.
 */
export async function searchSnippets(query: string): Promise<Snippet[]> {
  const lowerQuery = `%${query.toLowerCase()}%`;
  const rows = await db.getAllAsync(
    `SELECT * FROM snippets 
     WHERE lower(title) LIKE ? 
        OR lower(code) LIKE ? 
        OR lower(language) LIKE ? 
        OR lower(tags) LIKE ?
     ORDER BY created_at DESC`,
    [lowerQuery, lowerQuery, lowerQuery, lowerQuery]
  );
  return rows.map(formatSnippetRow);
}

/**
 * Get all distinct tags used across snippets.
 */
export async function getAllTags(): Promise<string[]> {
  const rows = await db.getAllAsync(`SELECT tags FROM snippets`);
  const tagsSet = new Set<string>();

  rows.forEach((row: any) => {
    try {
      const tags = JSON.parse(row.tags);
      if (Array.isArray(tags)) {
        tags.forEach(tag => tagsSet.add(tag.trim().toLowerCase()));
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  return Array.from(tagsSet).sort();
}

/**
 * Get all distinct languages used across snippets.
 */
export async function getAllLanguages(): Promise<string[]> {
  const rows = await db.getAllAsync(`SELECT DISTINCT language FROM snippets ORDER BY language ASC`);
  return rows.map((row: any) => row.language);
}

/**
 * Add a file attachment to a snippet.
 */
export async function addAttachment(
  snippetId: number,
  filePath: string,
  fileName: string,
  mimeType: string | null = null
): Promise<Attachment> {
  const result = await db.runAsync(
    `INSERT INTO attachments (snippet_id, file_path, file_name, mime_type)
     VALUES (?, ?, ?, ?)`,
    [snippetId, filePath, fileName, mimeType]
  );

  return {
    id: result.lastInsertRowId,
    snippet_id: snippetId,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,
  };
}

/**
 * Get all attachments for a specific snippet.
 */
export async function getAttachments(snippetId: number): Promise<Attachment[]> {
  const rows = await db.getAllAsync(`SELECT * FROM attachments WHERE snippet_id = ?`, [snippetId]);
  return rows.map((row: any) => ({
    id: row.id,
    snippet_id: row.snippet_id,
    file_path: row.file_path,
    file_name: row.file_name,
    mime_type: row.mime_type,
  }));
}

/**
 * Delete an attachment by ID.
 */
export async function deleteAttachment(id: number): Promise<void> {
  await db.runAsync(`DELETE FROM attachments WHERE id = ?`, [id]);
}

/**
 * Wipe all data from the database (for settings or reset).
 */
export async function wipeDatabase(): Promise<void> {
  await db.execAsync(`
    DELETE FROM attachments;
    DELETE FROM snippets;
  `);
}
