const agents = [
  { id: 'live-architect', name: 'Live Architect', role: 'architect', capabilities: ['cheap', 'planning'] },
  { id: 'live-builder', name: 'Live Builder', role: 'backend', capabilities: ['cheap', 'coding'] },
  { id: 'live-qa', name: 'Live QA', role: 'qa', capabilities: ['cheap', 'testing'] }
];
const endpoint = 'http://127.0.0.1:47821/api/agents/register';
const hubBase = 'http://127.0.0.1:47821';
async function beat() {
  for (const agent of agents) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(agent)
      });
    } catch {}
  }
}

async function processCommands() {
  for (const agent of agents) {
    try {
      const res = await fetch(`${hubBase}/api/commands/${encodeURIComponent(agent.id)}/pull`);
      if (!res.ok) continue;
      const commands = await res.json();
      for (const cmd of commands) {
        const output = `[${agent.name}] Received command "${cmd.message}" and processed it successfully.`;
        await fetch(`${hubBase}/api/commands/${encodeURIComponent(cmd.id)}/respond`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            output
          })
        });
      }
    } catch {}
  }
}

setInterval(beat, 15000);
setInterval(processCommands, 4000);
beat();
processCommands();
