import { ChangeEvent, useState } from "react";
import {
  inspectProject,
  loadProjectConfig,
  pickProjectDirectory,
  saveProjectConfig
} from "./lib/tauri";
import { AgentCardModel, ProjectConfig, ProjectSnapshot } from "./types";

const seedAgents: AgentCardModel[] = [
  {
    id: "lead",
    name: "Lead Architect",
    role: "architect",
    provider: "ollama",
    model: "qwen3.5",
    command: "claude",
    goal: "Break work into coherent streams, define contracts, and keep the team aligned.",
    status: "ready"
  },
  {
    id: "backend",
    name: "Backend Builder",
    role: "backend",
    provider: "ollama",
    model: "gpt-oss:20b",
    command: "codex",
    goal: "Implement APIs, services, and data flows without stepping on unrelated areas.",
    status: "blocked"
  },
  {
    id: "qa",
    name: "QA Sentinel",
    role: "qa",
    provider: "ollama",
    model: "qwen3.5",
    command: "ollama",
    goal: "Stress the feature, design regression coverage, and surface operational risks.",
    status: "offline"
  },
  {
    id: "scribe",
    name: "Vault Scribe",
    role: "docs",
    provider: "ollama",
    model: "qwen3.5",
    command: "ollama",
    goal: "Turn implementation output into durable Obsidian memory, ADRs, and delivery notes.",
    status: "ready"
  }
];

const activity = [
  {
    title: "Project Intake",
    detail: "Choose a local repository and inspect Git, docs, package files, and vault markers.",
    state: "live"
  },
  {
    title: "Squad Design",
    detail: "Assign each agent a role, provider, model, and operating rule before execution starts.",
    state: "live"
  },
  {
    title: "Execution Rail",
    detail: "Run architecture, implementation, QA, and docs as linked workstreams with shared memory.",
    state: "queued"
  }
] as const;

export function App() {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [agents, setAgents] = useState<AgentCardModel[]>(seedAgents);
  const [mission, setMission] = useState(
    "Run this repository as a coordinated AI dev team with explicit roles, shared memory, and guarded execution."
  );
  const [obsidianVaultPath, setObsidianVaultPath] = useState("");
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handlePickProject() {
    setIsPicking(true);
    setNotice(null);
    const selected = await pickProjectDirectory();

    if (!selected) {
      setIsPicking(false);
      return;
    }

    const snapshot =
      (await inspectProject(selected)) ?? {
        path: selected,
        name: selected.split(/[\\/]/).pop() ?? selected,
        isGitRepo: false,
        hasPackageJson: false,
        hasObsidianVault: false,
        hasDocs: false
      };

    setProject(snapshot);

    const config = await loadProjectConfig(selected);
    if (config) {
      hydrateConfig(config);
      setNotice("Loaded existing squad configuration from .pumice/project.json.");
    } else {
      setAgents(seedAgents);
      setMission(
        "Run this repository as a coordinated AI dev team with explicit roles, shared memory, and guarded execution."
      );
      setObsidianVaultPath(
        snapshot.hasObsidianVault ? `${selected}\\obsidian-vault` : ""
      );
      setNotice("No existing squad config found. Seeded the UI with defaults.");
    }

    setIsPicking(false);
  }

  async function handleSaveConfig() {
    if (!project) {
      setNotice("Select a project before saving the squad configuration.");
      return;
    }

    setIsSaving(true);
    setNotice(null);

    const payload: ProjectConfig = {
      mission,
      obsidianVaultPath,
      agents
    };

    const success = await saveProjectConfig(project.path, payload);
    setNotice(
      success
        ? "Squad configuration saved to .pumice/project.json."
        : "Failed to save squad configuration."
    );
    setIsSaving(false);
  }

  function hydrateConfig(config: ProjectConfig) {
    setMission(config.mission);
    setObsidianVaultPath(config.obsidianVaultPath);
    setAgents(config.agents);
  }

  function updateAgent(
    id: string,
    field: keyof AgentCardModel,
    value: AgentCardModel[keyof AgentCardModel]
  ) {
    setAgents((current) =>
      current.map((agent) =>
        agent.id === id ? { ...agent, [field]: value } : agent
      )
    );
  }

  function handleFieldChange(id: string, field: keyof AgentCardModel) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      updateAgent(id, field, event.target.value as AgentCardModel[keyof AgentCardModel]);
    };
  }

  function addAgent() {
    setAgents((current) => [
      ...current,
      {
        id: `agent-${crypto.randomUUID().slice(0, 8)}`,
        name: "New Agent",
        role: "frontend",
        provider: "ollama",
        model: "qwen3.5",
        command: "ollama",
        goal: "Define this agent's operating contract.",
        status: "ready"
      }
    ]);
  }

  function removeAgent(id: string) {
    setAgents((current) => current.filter((agent) => agent.id !== id));
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Pumice Control Room</p>
          <h1>Run a software squad, not a pile of disconnected prompts.</h1>
          <p className="lede">
            Open a repository, define who plays architect, implementer, QA, reviewer,
            and scribe, then let the team operate against shared project memory.
          </p>
        </div>

        <div className="hero-actions">
          <button className="primary-button" onClick={handlePickProject}>
            {isPicking ? "Opening..." : "Open Project Folder"}
          </button>
          <button className="secondary-button" onClick={handleSaveConfig}>
            {isSaving ? "Saving..." : "Save Squad Config"}
          </button>
          <p className="hint">
            Recommended stack: Claude Code + Codex + Ollama-backed local agents +
            Obsidian vault.
          </p>
          {notice ? <p className="notice">{notice}</p> : null}
        </div>
      </section>

      <section className="grid">
        <article className="panel project-panel">
          <div className="panel-heading">
            <span className="panel-kicker">Project</span>
            <h2>Workspace intake</h2>
          </div>

          {project ? (
            <div className="project-card">
              <div>
                <h3>{project.name}</h3>
                <p className="mono">{project.path}</p>
              </div>

              <div className="badge-row">
                <span className={`badge ${project.isGitRepo ? "ok" : "muted"}`}>
                  Git {project.isGitRepo ? "detected" : "missing"}
                </span>
                <span className={`badge ${project.hasPackageJson ? "ok" : "muted"}`}>
                  package.json {project.hasPackageJson ? "found" : "missing"}
                </span>
                <span
                  className={`badge ${project.hasObsidianVault ? "ok" : "muted"}`}
                >
                  vault {project.hasObsidianVault ? "found" : "missing"}
                </span>
                <span className={`badge ${project.hasDocs ? "ok" : "muted"}`}>
                  docs {project.hasDocs ? "found" : "missing"}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>No repository selected yet.</p>
              <p>
                The desktop app will inspect the folder and use that snapshot to seed the
                squad configuration.
              </p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <span className="panel-kicker">Mission</span>
            <h2>Operating brief</h2>
          </div>

          <div className="brief-form">
            <label className="field">
              <span>Mission</span>
              <textarea
                rows={5}
                value={mission}
                onChange={(event) => setMission(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Obsidian vault path</span>
              <input
                type="text"
                value={obsidianVaultPath}
                onChange={(event) => setObsidianVaultPath(event.target.value)}
                placeholder="C:\\Vaults\\Project or ./obsidian-vault"
              />
            </label>
          </div>
        </article>

        <article className="panel squad-panel">
          <div className="panel-heading">
            <span className="panel-kicker">Agents</span>
            <h2>Team composition</h2>
          </div>

          <div className="panel-toolbar">
            <p>
              Define each agent's role, provider, model, command, and operating
              objective before execution.
            </p>
            <button className="secondary-button" onClick={addAgent}>
              Add Agent
            </button>
          </div>

          <div className="agent-list">
            {agents.map((agent) => (
              <div className="agent-card" key={agent.id}>
                <div className="agent-topline">
                  <input
                    className="agent-name-input"
                    value={agent.name}
                    onChange={handleFieldChange(agent.id, "name")}
                  />
                  <div className="agent-actions">
                    <span className={`status-pill ${agent.status}`}>{agent.status}</span>
                    <button
                      className="ghost-button"
                      onClick={() => removeAgent(agent.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="editor-grid">
                  <label className="field">
                    <span>Role</span>
                    <select value={agent.role} onChange={handleFieldChange(agent.id, "role")}>
                      <option value="architect">architect</option>
                      <option value="backend">backend</option>
                      <option value="frontend">frontend</option>
                      <option value="qa">qa</option>
                      <option value="reviewer">reviewer</option>
                      <option value="docs">docs</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Provider</span>
                    <select
                      value={agent.provider}
                      onChange={handleFieldChange(agent.id, "provider")}
                    >
                      <option value="ollama">ollama</option>
                      <option value="native">native</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Status</span>
                    <select
                      value={agent.status}
                      onChange={handleFieldChange(agent.id, "status")}
                    >
                      <option value="ready">ready</option>
                      <option value="blocked">blocked</option>
                      <option value="offline">offline</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Model</span>
                    <input
                      type="text"
                      value={agent.model}
                      onChange={handleFieldChange(agent.id, "model")}
                    />
                  </label>

                  <label className="field">
                    <span>Command</span>
                    <input
                      type="text"
                      value={agent.command}
                      onChange={handleFieldChange(agent.id, "command")}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Goal</span>
                  <textarea
                    rows={3}
                    value={agent.goal}
                    onChange={handleFieldChange(agent.id, "goal")}
                  />
                </label>
              </div>
            ))}
          </div>
        </article>

        <article className="panel rail-panel">
          <div className="panel-heading">
            <span className="panel-kicker">Run Rail</span>
            <h2>Execution stages</h2>
          </div>

          <div className="timeline">
            {activity.map((item, index) => (
              <div className="timeline-row" key={item.title}>
                <div className={`timeline-marker ${item.state}`}>{index + 1}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
