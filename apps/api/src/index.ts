import { buildServer } from './server'
import { createDb } from './db/setup'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  const db = createDb()
  const app = buildServer({ db, logger: true })

  try {
    await app.listen({ port: PORT, host: HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
