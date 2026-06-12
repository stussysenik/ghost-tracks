/**
 * Ghost Tracks gateway — entrypoint.
 *
 * Wires environment config into the app factory and exports the Bun server
 * descriptor. All behavior lives in `app.ts`; this file only reads env and
 * opens the production shares database.
 *
 *   BRAIN_URL  — Python brain  (default http://localhost:8000)
 *   KERNEL_URL — Scala kernel  (default http://localhost:8080)
 *   PORT       — gateway port  (default 3000)
 */
import { createApp } from './app.ts'
import { openSharesDb } from './db.ts'

const BRAIN_URL = Bun.env.BRAIN_URL ?? 'http://localhost:8000'
const KERNEL_URL = Bun.env.KERNEL_URL ?? 'http://localhost:8080'
const PORT = Number(Bun.env.PORT ?? 3000)

const db = openSharesDb(`${import.meta.dir}/data/shares.sqlite`)

const app = createApp({ brainUrl: BRAIN_URL, kernelUrl: KERNEL_URL, db })

export default {
  port: PORT,
  fetch: app.fetch,
}
