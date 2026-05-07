import { 
  KaspaKeyGenerator, 
  GeneratedKaspaDevAccount 
} from "./real-keygen.js";

export interface KaspaSdkKeyGeneratorOptions {
  readonly networkId?: "simnet" | "testnet-10" | "mainnet";
  readonly sdkLoader?: () => Promise<any>;
}

/**
 * Adapter for Kaspa SDK key generation.
 * Uses dynamic imports to avoid breaking if the SDK is not installed.
 */
export class KaspaSdkKeyGenerator implements KaspaKeyGenerator {
  private readonly networkId: string;
  private readonly sdkLoader: () => Promise<any>;

  constructor(options?: KaspaSdkKeyGeneratorOptions) {
    this.networkId = options?.networkId || "simnet";
    const rawLoader = options?.sdkLoader || (async () => {
      // @ts-ignore
      return await import("kaspa");
    });

    this.sdkLoader = async () => {
      try {
        return await rawLoader();
      } catch (e) {
        throw new Error(
          "Kaspa SDK key generation dependency is not installed. " +
          "Install/configure the supported Kaspa WASM SDK adapter. " +
          "Use 'hardkas accounts real import' to add accounts manually for now."
        );
      }
    };
  }

  async generateAccount(options?: {
    readonly networkId?: "simnet" | "testnet-10" | "mainnet";
  }): Promise<GeneratedKaspaDevAccount> {
    const sdk = await this.sdkLoader();
    const network = options?.networkId || this.networkId;

    // Depending on the SDK structure:
    // If using rusty-kaspa/kaspa-wasm:
    // const privateKey = new sdk.PrivateKey();
    // const publicKey = privateKey.toPublicKey();
    // const address = publicKey.toAddress(network);
    
    // For now, we assume a standard interface if it was found.
    // Since we don't have the exact SDK version confirmed in dependencies, 
    // we use a defensive implementation.

    try {
      if (typeof sdk.PrivateKey === "function") {
        const privKey = new sdk.PrivateKey();
        const pubKey = privKey.toPublicKey();
        const address = pubKey.toAddress(network).toString();
        const privateKeyStr = privKey.toString();
        const publicKeyStr = pubKey.toString();

        return {
          address,
          publicKey: publicKeyStr,
          privateKey: privateKeyStr
        };
      }
      
      // Fallback for different SDK versions/structures if known
      throw new Error("Loaded Kaspa SDK does not expose expected PrivateKey constructor.");
    } catch (e) {
      throw new Error(`Failed to generate account using SDK: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
