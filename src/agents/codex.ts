import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runCodex(prompt: string) {
  return runCommand(config.codexCommand, [prompt]);
}
