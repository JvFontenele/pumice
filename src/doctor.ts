import { config } from "./config.js";
import { runCommand } from "./utils/exec.js";

async function main() {
  console.log(`# Pumice Doctor`);
  console.log("");
  console.log(`Project: ${config.projectName}`);
  console.log(`Ollama base URL: ${config.ollamaBaseUrl}`);
  console.log("");

  if (config.claude.provider === "native" || config.claude.provider === "ollama") {
    await checkAgent("Claude", config.claude.command, config.claude.provider, [
      "--help"
    ]);
  }

  if (config.codex.provider === "native" || config.codex.provider === "ollama") {
    await checkAgent("Codex", config.codex.command, config.codex.provider, [
      "--help"
    ]);
  }

  if (config.gemini.provider === "native") {
    await checkAgent("Gemini", config.gemini.command, config.gemini.provider, [
      "--help"
    ]);
  } else {
    console.log(`## Gemini`);
    console.log(`Provider: ${config.gemini.provider}`);
    console.log(`Status: skipped`);
    console.log("");
    console.log("Gemini tasks are configured to run through Ollama.");
    console.log("");
  }

  if (
    config.claude.provider === "ollama" ||
    config.codex.provider === "ollama" ||
    config.gemini.provider === "ollama"
  ) {
    await checkAgent("Ollama", config.ollamaCommand, "ollama", ["--version"]);
    await checkAgent("Ollama models", config.ollamaCommand, "ollama", ["list"]);
  }
}

async function checkAgent(
  label: string,
  command: string,
  provider: string,
  args: string[]
) {
  const result = await runCommand(command, args);

  console.log(`## ${label}`);
  console.log(`Provider: ${provider}`);
  console.log(`Command: ${command} ${args.join(" ")}`.trim());
  console.log(`Status: ${result.success ? "ok" : "error"}`);
  console.log("");
  console.log((result.success ? result.stdout : result.stderr).trim() || "(no output)");
  console.log("");
}

main().catch((error) => {
  console.error("Doctor failed:", error);
  process.exit(1);
});
