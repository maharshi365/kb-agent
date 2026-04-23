import { getCoreStatus } from "@kb/core";

export function registerOpencodePlugin(): string {
  const status = getCoreStatus();
  return `opencode plugin loaded (core: ${status})`;
}
