import { homedir } from "node:os";
import { join } from "node:path";

export function getUserDataDir(): string {
  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  return process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
}
