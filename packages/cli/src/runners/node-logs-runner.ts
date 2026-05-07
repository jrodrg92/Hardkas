import { DockerKaspadRunner } from "@hardkas/node-runner";

export interface NodeLogsRunnerInput {
  containerName?: string;
  tail?: number;
}

export async function runNodeLogs(input: NodeLogsRunnerInput): Promise<string> {
  const runner = new DockerKaspadRunner({ containerName: input.containerName });
  return runner.logs({ tail: input.tail });
}
