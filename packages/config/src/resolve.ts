import { DEFAULT_HARDKAS_CONFIG } from "./defaults";
import type { HardkasConfig, HardkasNetworkTarget } from "./types";

export interface ResolveNetworkTargetOptions {
  config: HardkasConfig;
  network?: string;
}

export function resolveNetworkTarget(
  options: ResolveNetworkTargetOptions
): {
  name: string;
  target: HardkasNetworkTarget;
} {
  const { config, network } = options;
  const name = network || config.defaultNetwork || "simnet";
  
  const networks = config.networks && Object.keys(config.networks).length > 0 
    ? config.networks 
    : DEFAULT_HARDKAS_CONFIG.networks!;

  const target = networks[name];

  if (!target) {
    const available = Object.keys(networks).join(", ");
    throw new Error(`Unknown HardKAS network '${name}'. Available networks: ${available}`);
  }

  return {
    name,
    target
  };
}
