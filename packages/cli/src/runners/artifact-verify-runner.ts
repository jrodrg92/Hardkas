import { verifyArtifact } from "@hardkas/artifacts";
import { UI } from "../ui.js";
import path from "node:path";

export interface ArtifactVerifyOptions {
  path: string;
  json?: boolean;
}

export async function runArtifactVerify(options: ArtifactVerifyOptions) {
  const absolutePath = path.resolve(process.cwd(), options.path);
  const result = await verifyArtifact(absolutePath);

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
    if (result.artifactType) console.log(`  Type:    ${result.artifactType}`);
    if (result.version)      console.log(`  Version: ${result.version}`);
    
    if (result.expectedHash || result.actualHash) {
      console.log(`  Expected Hash: ${result.expectedHash || "None"}`);
      console.log(`  Actual Hash:   ${result.actualHash || "N/A"}`);
    }

    console.log("\nErrors:");
    result.errors.forEach(err => console.log(`- ${err}`));
  }

  return result;
}
