import { UniverseManager, type KbConfig } from "./universe-manager";

export const universeManager = new UniverseManager();
export const kbConfig: KbConfig = universeManager.getKbConfig();
