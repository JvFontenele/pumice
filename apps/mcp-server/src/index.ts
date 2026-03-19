#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { buildMcpServer } from './server.js'

const API_URL = process.env.PUMICE_API_URL ?? 'http://localhost:3001'

const server = buildMcpServer(API_URL)
const transport = new StdioServerTransport()

await server.connect(transport)
