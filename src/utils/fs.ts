import { mkdir, readFile, writeFile } from "node:fs/promises";

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function saveTextFile(path: string, content: string) {
  await writeFile(path, content, "utf-8");
}

export async function readTextFile(path: string) {
  return readFile(path, "utf-8");
}
