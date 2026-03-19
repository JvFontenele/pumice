import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { PumiceClient } from './pumice-client.js'

/**
 * Builds the Pumice MCP server.
 *
 * Each stdio session gets its own McpServer instance (called from index.ts
 * per-connection). The session maintains agentId/token in a closure so the
 * agent stays registered across multiple tool calls without re-registering.
 */
export function buildMcpServer(apiUrl: string): McpServer {
  const server = new McpServer({
    name: 'pumice',
    version: '0.0.1',
  })

  const client = new PumiceClient({ baseUrl: apiUrl })

  // ── Session state ──────────────────────────────────────────────────────────
  // Persists within one stdio session; reset on reconnect.
  let sessionAgentId: string | null = null
  let sessionToken: string | null = null

  function ensureRegistered() {
    if (!sessionAgentId) throw new Error('Not registered. Call agent_register first.')
    return { agentId: sessionAgentId, token: sessionToken! }
  }

  // ── agent_register ─────────────────────────────────────────────────────────
  server.tool(
    'agent_register',
    'Register this AI as a Pumice agent. Must be called before using agent_* tools. Returns agentId and token that are stored for this session.',
    {
      name:         z.string().describe('Display name for this agent, e.g. "claude-desktop"'),
      provider:     z.enum(['claude', 'codex', 'gemini', 'ollama']).describe('AI provider identifier'),
      capabilities: z.array(z.string()).describe('List of capability tags, e.g. ["text","code","analysis"]'),
    },
    async ({ name, provider, capabilities }) => {
      const reg = await client.register({ name, provider, capabilities })
      sessionAgentId = reg.agentId
      sessionToken   = reg.token
      client.token   = reg.token
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ agentId: reg.agentId, status: 'registered', message: `Registered as "${name}" (${provider}). agentId stored for this session.` }, null, 2),
        }],
      }
    },
  )

  // ── agent_heartbeat ────────────────────────────────────────────────────────
  server.tool(
    'agent_heartbeat',
    'Send a heartbeat to keep this agent marked as online. Call every ~15 seconds if staying idle.',
    {},
    async () => {
      const { agentId } = ensureRegistered()
      await client.heartbeat(agentId)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, agentId, timestamp: new Date().toISOString() }) }] }
    },
  )

  // ── agent_pull_commands ────────────────────────────────────────────────────
  server.tool(
    'agent_pull_commands',
    'Pull pending commands assigned to this agent from the Pumice control plane. Returns an array of commands. Each command has an id, payload (JSON with prompt/role/goal), and runId. After processing a command, call agent_post_response.',
    {},
    async () => {
      const { agentId } = ensureRegistered()
      const { commands } = await client.pullCommands(agentId)
      const msg = commands.length === 0
        ? 'No pending commands.'
        : `${commands.length} command(s) pending.`
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ message: msg, commands }, null, 2),
        }],
      }
    },
  )

  // ── agent_post_response ────────────────────────────────────────────────────
  server.tool(
    'agent_post_response',
    'Post a response to a command received via agent_pull_commands. Set partial=true for streaming chunks; partial=false for the final response. Set failed=true if the command could not be completed.',
    {
      commandId: z.string().describe('The command id from agent_pull_commands'),
      output:    z.string().describe('Your response text or result'),
      partial:   z.boolean().default(false).describe('true = streaming chunk, false = final response'),
      failed:    z.boolean().default(false).optional().describe('true if this command failed'),
    },
    async ({ commandId, output, partial, failed }) => {
      const { agentId } = ensureRegistered()
      const result = await client.postResponse({ commandId, agentId, output, partial, failed })
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, responseId: (result as { responseId: string }).responseId, commandStatus: (result as { command: { status: string } }).command?.status }, null, 2),
        }],
      }
    },
  )

  // ── agent_update_status ────────────────────────────────────────────────────
  server.tool(
    'agent_update_status',
    'Update this agent\'s operational status in the control plane.',
    {
      status: z.enum(['idle', 'working', 'error', 'offline']).describe('New status'),
    },
    async ({ status }) => {
      const { agentId } = ensureRegistered()
      await client.updateStatus(agentId, status)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, agentId, status }) }] }
    },
  )

  // ── agent_list ─────────────────────────────────────────────────────────────
  server.tool(
    'agent_list',
    'List all agents currently registered in the Pumice control plane, with their status and capabilities. Useful for discovering other agents to target in flows.',
    {},
    async () => {
      const { agents } = await client.listAgents()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: agents.length, agents }, null, 2),
        }],
      }
    },
  )

  // ── flow_list ──────────────────────────────────────────────────────────────
  server.tool(
    'flow_list',
    'List all flows defined in Pumice. Each flow has steps (with agentId targets and dependencies), policy (serial/parallel/mixed), and a goal.',
    {},
    async () => {
      const { flows } = await client.listFlows()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: flows.length, flows }, null, 2),
        }],
      }
    },
  )

  // ── flow_start_run ─────────────────────────────────────────────────────────
  server.tool(
    'flow_start_run',
    'Start a run for a given flow. The DAG engine will queue commands to the assigned agents. Returns the run id to track with run_get.',
    {
      flowId: z.string().describe('Flow id from flow_list'),
      input:  z.string().optional().describe('Optional text input/context for this run'),
    },
    async ({ flowId, input }) => {
      const { run } = await client.startRun(flowId, input)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ message: 'Run started. Use run_get to track progress.', run }, null, 2),
        }],
      }
    },
  )

  // ── run_get ────────────────────────────────────────────────────────────────
  server.tool(
    'run_get',
    'Get the current status and step timeline of a run. Poll this after starting a run to see when steps complete.',
    {
      runId: z.string().describe('Run id from flow_start_run or run_list'),
    },
    async ({ runId }) => {
      const data = await client.getRun(runId)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        }],
      }
    },
  )

  // ── run_list ───────────────────────────────────────────────────────────────
  server.tool(
    'run_list',
    'List recent runs with their status and step progress.',
    {},
    async () => {
      const { runs } = await client.listRuns()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: runs.length, runs }, null, 2),
        }],
      }
    },
  )

  // ── context_compose ────────────────────────────────────────────────────────
  server.tool(
    'context_compose',
    'Retrieve the assembled context from the Pumice context engine (vault notes + manual blocks). Use this to enrich your prompts with project knowledge before responding to commands.',
    {
      maxTokens:   z.number().optional().default(8000).describe('Token budget for context assembly'),
      runtimeText: z.string().optional().describe('Additional runtime text to inject'),
    },
    async ({ maxTokens, runtimeText }) => {
      const result = await client.composeContext({ maxTokens, runtimeText })
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            totalTokens: result.totalTokens,
            truncated: result.truncated,
            blockCount: (result.blocks as unknown[]).length,
            text: result.text,
          }, null, 2),
        }],
      }
    },
  )

  // ── context_save_handoff ───────────────────────────────────────────────────
  server.tool(
    'context_save_handoff',
    'Save a handoff note to the Obsidian vault (04-handoffs/). Use this to leave context for the next agent or session.',
    {
      content: z.string().describe('Markdown content for the handoff note'),
    },
    async ({ content }) => {
      const result = await client.writeHandoff(content)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, file: result.file }, null, 2),
        }],
      }
    },
  )

  return server
}
