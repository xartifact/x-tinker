import { useState } from "react";
import type { RepoConfig } from "@xartifact/x-tinker-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { FolderCode, GitBranch } from "lucide-react";

interface Props {
  config: RepoConfig;
  onSave: (config: RepoConfig) => void;
  saving: boolean;
}

export function RepoConfigForm({ config, onSave, saving }: Props) {
  const [projectPath, setProjectPath] = useState(config.projectPath);
  const [remote, setRemote] = useState(config.remote);
  const [branchPrefix, setBranchPrefix] = useState(config.branchPrefix);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ projectPath, remote, branchPrefix });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderCode className="h-5 w-5" />
          Repository Configuration
        </CardTitle>
        <CardDescription>
          Source code location of Project A — the application that reports runtime errors for auto-fix.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectPath" className="flex items-center gap-2">
              <FolderCode className="h-4 w-4 text-muted-foreground" />
              Project A Source Path
            </Label>
            <Input
              id="projectPath"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/project-a"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Local path to the project that reports errors and needs fixes</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="remote" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Git Remote (optional)
              </Label>
              <Input
                id="remote"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
                placeholder="git@github.com:user/repo.git"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Leave empty for local-only mode</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchPrefix" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                Branch Prefix
              </Label>
              <Input
                id="branchPrefix"
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Auto-fix branches: {branchPrefix}/&lt;event-id&gt;</p>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Repo Config"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}