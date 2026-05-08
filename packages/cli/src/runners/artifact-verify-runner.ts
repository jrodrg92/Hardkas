import { verifyArtifactIntegrity } from "@hardkas/artifacts";
import { UI } from "../ui.js";
import path from "node:path";
import fs from "node:fs";

export interface ArtifactVerifyOptions {
  path: string;
  json?: boolean;
  recursive?: boolean;
}

export async function runArtifactVerify(options: ArtifactVerifyOptions) {
  const absolutePath = path.resolve(process.cwd(), options.path);
  
  if (!fs.existsSync(absolutePath)) {
    UI.error(`Path not found: ${options.path}`);
    process.exitCode = 1;
    return;
  }

  const stats = fs.statSync(absolutePath);
  const isDir = stats.isDirectory();

  if (isDir) {
    if (options.recursive) {
      return runRecursiveVerify(absolutePath, options);
    } else {
      UI.error(`${options.path} is a directory. Use --recursive to verify all artifacts within it.`);
      process.exitCode = 1;
      return;
    }
  }

  // Single file verification
  const result = await verifyArtifactIntegrity(absolutePath);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  UI.header(`Artifact Verification: ${path.basename(options.path)}`);
  
  if (result.ok) {
    UI.success("VERIFICATION SUCCESSFUL");
    console.log(`  Type:    ${result.artifactType}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Hash:    ${result.actualHash}`);
  } else {
    UI.error("VERIFICATION FAILED");
    renderErrors(result);
    process.exitCode = 1;
  }

  return result;
}

async function runRecursiveVerify(dir: string, options: ArtifactVerifyOptions) {
  const files = getAllJsonFiles(dir);
  UI.header(`Recursive Verification: ${path.basename(dir)}`);
  console.log(`Auditing ${files.length} artifact(s)...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const relativePath = path.relative(dir, file);
    const result = await verifyArtifactIntegrity(file);
    
    if (result.ok) {
      console.log(`  ✓ ${relativePath.padEnd(40)} [MATCH]`);
      successCount++;
    } else {
      console.log(`  ✗ ${relativePath.padEnd(40)} [FAIL]`);
      result.errors.forEach(err => console.log(`      [!] ${err}`));
      failCount++;
    }
  }

  console.log("\n" + "═".repeat(50));
  if (failCount === 0) {
    UI.success(`Audit Complete: All ${successCount} artifacts verified.`);
  } else {
    UI.error(`Audit Failed: ${failCount} artifact(s) corrupted or invalid.`);
    process.exitCode = 1;
  }
}

function getAllJsonFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllJsonFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".json")) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function renderErrors(result: any) {
  if (result.artifactType) console.log(`  Type:    ${result.artifactType}`);
  if (result.version)      console.log(`  Version: ${result.version}`);
  
  if (result.expectedHash || result.actualHash) {
    console.log(`  Expected Hash: ${result.expectedHash || "None"}`);
    console.log(`  Actual Hash:   ${result.actualHash || "N/A"}`);
  }

  console.log("\nErrors:");
  result.errors.forEach((err: string) => console.log(`- ${err}`));
}
