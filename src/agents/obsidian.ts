import path from "node:path";
import { config } from "../config.js";
import { ensureDir, saveTextFile } from "../utils/fs.js";

export async function writeObsidianNote(noteName: string, content: string) {
  await ensureDir(config.obsidianVaultDir);
  const fullPath = path.join(config.obsidianVaultDir, `${noteName}.md`);
  await saveTextFile(fullPath, content);
  return fullPath;
}
