import { trpc } from "../trpc";
import { AgentConfigForm } from "../components/agent-config-form";
import { LLMConfigForm } from "../components/llm-config-form";
import { RepoConfigForm } from "../components/repo-config-form";
import { ServerConfigForm } from "../components/server-config-form";
import type { AppConfig } from "@xartifact/x-tinker-shared";

export function ConfigPage() {
  const { data, isLoading, error } = trpc.appConfig.get.useQuery();
  const saveMutation = trpc.appConfig.save.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading configuration...</div>;
  if (error) return <div className="p-4 text-destructive">Error: {error.message}</div>;
  if (!data) return <div className="p-4 text-muted-foreground">No configuration loaded</div>;

  const handleSave = (partial: Partial<AppConfig>) => {
    const merged: AppConfig = {
      ...data,
      ...partial,
      agent: { ...data.agent, ...partial.agent },
      llm: { ...data.llm, ...partial.llm },
      repo: { ...data.repo, ...partial.repo },
      server: { ...data.server, ...partial.server },
    };
    saveMutation.mutate(merged);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-muted-foreground mt-1">Configure the auto-fix pipeline</p>
      </div>

      <AgentConfigForm
        config={data.agent}
        onSave={(agent) => handleSave({ agent })}
        saving={saveMutation.isPending}
      />

      <LLMConfigForm
        config={data.llm}
        onSave={(llm) => handleSave({ llm })}
        saving={saveMutation.isPending}
      />

      <RepoConfigForm
        config={data.repo}
        onSave={(repo) => handleSave({ repo })}
        saving={saveMutation.isPending}
      />

      <ServerConfigForm
        config={data.server}
        onSave={(server) => handleSave({ server })}
        saving={saveMutation.isPending}
      />
    </div>
  );
}
