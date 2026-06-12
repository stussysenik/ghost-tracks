/**
 * Ghost Tracks gateway — share-link persistence.
 *
 * MVP persistence per SPEC §7: SQLite via Bun's built-in `bun:sqlite`
 * (zero native-dep install, synchronous API — fine for a BFF whose writes
 * are tiny JSON blobs). The store is wrapped behind a small interface so
 * the Hono app can be constructed with a temp database in tests and a
 * real file in production.
 */
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface SharesStore {
  /** Persist an ArtRoute JSON blob under a share id. */
  insert(id: string, artRoute: unknown): void
  /** Fetch a stored ArtRoute, or null when the id is unknown. */
  get(id: string): unknown | null
  close(): void
}

/**
 * Open (and lazily create) the shares database.
 *
 * Teaching note: `CREATE TABLE IF NOT EXISTS` makes startup idempotent —
 * no migration tooling needed for a single-table MVP. Prepared statements
 * are compiled once and reused for every request.
 */
export function openSharesDb(path: string): SharesStore {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path, { create: true })
  db.run(`
    CREATE TABLE IF NOT EXISTS shares (
      id         TEXT PRIMARY KEY,
      art_route  TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const insertStmt = db.query(
    'INSERT INTO shares (id, art_route) VALUES ($id, $route)',
  )
  const getStmt = db.query('SELECT art_route FROM shares WHERE id = $id')

  return {
    insert(id, artRoute) {
      insertStmt.run({ $id: id, $route: JSON.stringify(artRoute) })
    },
    get(id) {
      const row = getStmt.get({ $id: id }) as { art_route: string } | null
      return row ? JSON.parse(row.art_route) : null
    },
    close() {
      db.close()
    },
  }
}

/**
 * 10-char base36 share id derived from crypto.randomUUID bytes.
 *
 * A UUIDv4 carries 122 random bits; re-encoding the 128-bit hex value in
 * base36 and keeping 10 chars preserves ~51 bits of entropy — far beyond
 * collision range for MVP share volumes, while staying short and
 * URL-friendly ([0-9a-z] only, matching ShareIdSchema).
 */
export function newShareId(): string {
  const hex = crypto.randomUUID().replaceAll('-', '')
  return BigInt(`0x${hex}`).toString(36).slice(0, 10).padStart(10, '0')
}
