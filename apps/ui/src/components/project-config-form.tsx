import { useState } from "react";
import { trpc } from "../trpc";
import type { ProjectConfig } from "@xartifact/x-tinker-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { FolderCode, GitBranch, Boxes, FlaskConical, Plus, Trash2, Save } from "lucide-react";

interface Props {
  projects: ProjectConfig[];
}

/**
 * Multi-project management: list configured projects, edit repo/verify
 * settings, add and remove projects. Each card persists independently via
 * the tRPC projects router.
 */
export function ProjectsSection({ projects }: Props) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.appConfig.get.invalidate();
    utils.projects.list.invalidate();
    utils.events.list.invalidate();
  };
  const onError = (e: unknown) => alert(e instanceof Error ? e.message : String(e));

  const createMutation = trpc.projects.create.useMutation({ onSuccess: invalidate, onError });
  const updateMutation = trpc.projects.update.useMutation({ onSuccess: invalidate, onError });
  const deleteMutation = trpc.projects.delete.useMutation({ onSuccess: invalidate, onError });

  const [creating, setCreating] = useState(false);
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Projects
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Each project maps the projectId reported by the SDK to its source repo and verify command.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={creating} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      {creating && (
        <ProjectCard
          mode="create"
          onSave={(p) =>
            createMutation.mutate(p, {
              onSuccess: () => setCreating(false),
            })
          }
          onCancel={() => setCreating(false)}
          saving={busy}
        />
      )}

      {projects.length === 0 && !creating && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No projects configured yet. Add one, or keep using the PROJECT_A_PATH environment variable.
          </CardContent>
        </Card>
      )}

      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          mode="edit"
          project={p}
          onSave={(next) => updateMutation.mutate(next)}
          onDelete={() => {
            if (confirm(`Delete project "${p.id}"? Its error history stays in the database.`)) {
              deleteMutation.mutate({ id: p.id });
            }
          }}
          saving={busy}
        />
      ))}
    </div>
  );
}

interface CardProps {
  mode: "create" | "edit";
  project?: ProjectConfig;
  onSave: (project: ProjectConfig) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  saving: boolean;
}

function ProjectCard({ mode, project, onSave, onCancel, onDelete, saving }: CardProps) {
  const isNew = mode === "create";
  const [id, setId] = useState(project?.id ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [projectPath, setProjectPath] = useState(project?.repo.projectPath ?? "");
  const [remote, setRemote] = useState(project?.repo.remote ?? "");
  const [branchPrefix, setBranchPrefix] = useState(project?.repo.branchPrefix ?? "auto-fix");
  const [verifyCommand, setVerifyCommand] = useState(project?.verifyCommand ?? "");

  const [touched, setTouched] = useState(false);
  const dirty = isNew || touched;

  const buildConfig = (): ProjectConfig => ({
    id: id.trim(),
    name: name.trim() || id.trim(),
    repo: { projectPath: projectPath.trim(), remote: remote.trim(), branchPrefix: branchPrefix.trim() || "auto-fix" },
    verifyCommand: verifyCommand.trim(),
    ...(project?.agent ? { agent: project.agent } : {}),
  });

  const canSave = id.trim().length > 0 && dirty;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderCode className="h-5 w-5" />
          {isNew ? "New Project" : project?.name || id}
        </CardTitle>
        <CardDescription>
          {isNew
            ? "The project id must match the projectId your app's SDK reports."
            : `projectId: ${project?.id}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isNew && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-project-id">Project ID</Label>
                <Input id="new-project-id" value={id} onChange={(e) => { setTouched(true); setId(e.target.value); }} placeholder="x-herald" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-project-name">Display Name</Label>
                <Input id="new-project-name" value={name} onChange={(e) => { setTouched(true); setName(e.target.value); }} placeholder="X Herald Gateway" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`path-${id}`} className="flex items-center gap-2">
              <FolderCode className="h-4 w-4 text-muted-foreground" />
              Source Path
            </Label>
            <Input
              id={`path-${id}`}
              value={projectPath}
              onChange={(e) => { setTouched(true); setProjectPath(e.target.value); }}
              placeholder="/path/to/project"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Local path to the project source that reports errors and gets fixed</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`remote-${id}`} className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Git Remote (optional)
              </Label>
              <Input id={`remote-${id}`} value={remote} onChange={(e) => { setTouched(true); setRemote(e.target.value); }} placeholder="git@github.com:user/repo.git" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`branch-${id}`} className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Branch Prefix
              </Label>
              <Input id={`branch-${id}`} value={branchPrefix} onChange={(e) => { setTouched(true); setBranchPrefix(e.target.value); }} className="font-mono" />
              <p className="text-xs text-muted-foreground">Auto-fix branches: {branchPrefix}/&lt;event-id&gt;</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`verify-${id}`} className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              Verify Command (optional)
            </Label>
            <Input id={`verify-${id}`} value={verifyCommand} onChange={(e) => { setTouched(true); setVerifyCommand(e.target.value); }} placeholder="bun test" className="font-mono" />
            <p className="text-xs text-muted-foreground">
              Runs in the source path after a fix is applied; non-zero exit marks the fix as failed. Empty = skip verification.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onSave(buildConfig())} disabled={!canSave || saving} className="gap-1">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : isNew ? "Create Project" : "Save Project"}
            </Button>
            {isNew ? (
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            ) : (
              <Button variant="destructive" onClick={onDelete} disabled={saving} className="gap-1">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
