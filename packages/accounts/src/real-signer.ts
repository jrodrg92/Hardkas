import { RealTxPlanArtifact } from "@hardkas/artifacts";
import { RealDevAccount } from "@hardkas/localnet";

export interface RealTxSigningInput {
  readonly plan: RealTxPlanArtifact;
  readonly account: RealDevAccount;
}

export interface RealTxSigningResult {
  readonly signedTransaction: {
    readonly format: "kaspa-sdk" | "hex" | "json" | "unknown";
    readonly payload: string;
  };
  readonly txId?: string;
}

export interface RealTxSigner {
  sign(input: RealTxSigningInput): Promise<RealTxSigningResult>;
}

export class UnsupportedRealTxSigner implements RealTxSigner {
  async sign(): Promise<RealTxSigningResult> {
    throw new Error(
      "Real transaction signing is not configured yet. Install/configure a supported Kaspa SDK signer adapter."
    );
  }
}
