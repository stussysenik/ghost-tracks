import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import logfire from 'logfire'

// Configure logfire for local dev
logfire.configureLogfireApi({ sendToLogfire: false })

const app = new Hono()

app.use('*', cors())
app.use('*', async (c, next) => {
  logfire.info(`${c.req.method} ${c.req.path} started`)
  await next()
  logfire.info(`${c.req.method} ${c.req.path} finished`)
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'hono-bun' }))

// Placeholder for shape generation
const GenerateSchema = z.object({
  shape: z.string().optional(),
  neighborhood: z.string(),
  constraints: z.array(z.string()).optional(),
  count: z.number().optional(),
})

app.post('/api/generate', zValidator('json', GenerateSchema), async (c) => {
  const data = c.req.valid('json')
  
  try {
    const response = await fetch('http://localhost:8000/generate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    return c.json(result, response.status as any)
  } catch (err) {
    logfire.error("Proxy to FastAPI failed", { error: err })
    return c.json({ error: 'FastAPI backend unreachable' }, 502)
  }
})

export default {
  port: 3000,
  fetch: app.fetch,
}
