import fs from "node:fs/promises";
import path from "node:path";
import { assertValidTxPlanArtifact, assertValidSignedTxArtifact } from "./validate.js";
import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";

export const bigIntReplacer = (_key: string, value: any) => 
  typeof value === "bigint" ? value.toString() : value;

export async function writeArtifact(filePath: string, artifact: unknown): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    const content = typeof artifact === "string" 
      ? artifact 
      : JSON.stringify(artifact, bigIntReplacer, 2) + "\n";
      
    await fs.writeFile(filePath, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write artifact at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readArtifact(filePath: string): Promise<unknown> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      throw new Error(`Artifact file not found at ${filePath}`);
    }
    throw new Error(`Failed to read/parse artifact at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readTxPlanArtifact(filePath: string): Promise<TxPlanArtifact> {
  const data = await readArtifact(filePath);
  assertValidTxPlanArtifact(data);
  return data;
}

export async function readSignedTxArtifact(filePath: string): Promise<SignedTxArtifact> {
  const data = await readArtifact(filePath);
  assertValidSignedTxArtifact(data);
  return data;
}
