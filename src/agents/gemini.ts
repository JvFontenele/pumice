import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runGemini(prompt: string) {
  return runCommand(config.geminiCommand, [prompt]);
}
