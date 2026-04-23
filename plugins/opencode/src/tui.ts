import type { TuiPluginModule } from "@opencode-ai/plugin/tui";

const tui: TuiPluginModule["tui"] = async (api) => {
  api.command.register(() => [
    {
      title: "KB Universe",
      value: "kb.universe",
      description: "Manage KB universes with /kb-universe",
      slash: {
        name: "kb-universe",
      },
      onSelect: () => {},
    },
  ]);
};

export default {
  id: "@kb/plugin-opencode",
  tui,
} satisfies TuiPluginModule;
