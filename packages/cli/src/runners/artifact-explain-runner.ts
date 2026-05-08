import { explainArtifact } from "@hardkas/artifacts";
import { UI } from "../ui.js";
import path from "node:path";
import fs from "node:fs";

export interface ArtifactExplainOptions {
  path: string;
}

export async function runArtifactExplain(options: ArtifactExplainOptions) {
  const absolutePath = path.resolve(process.cwd(), options.path);
  
  if (!fs.existsSync(absolutePath)) {
    UI.error(`Path not found: ${options.path}`);
    process.exitCode = 1;
    return;
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    const artifact = JSON.parse(content);
    
    UI.header(`Artifact Explanation: ${path.basename(options.path)}`);
    
    const explanation = explainArtifact(artifact);
    console.log(explanation);
    console.log("");
    
  } catch (e: any) {
    UI.error(`Failed to explain artifact: ${e.message}`);
    process.exitCode = 1;
  }
}
