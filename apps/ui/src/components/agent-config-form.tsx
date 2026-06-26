import { useState } from "react";
import type { AgentConnection } from "@xartifact/x-tinker-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Bot, Settings2 } from "lucide-react";

interface Props {
  config: AgentConnection;
  onSave: (config: AgentConnection) => void;
  saving: boolean;
}

export function AgentConfigForm({ config, onSave, saving }: Props) {
  const [provider, setProvider] = useState(config.provider);
  const [agentConfig, setAgentConfig] = useState(config.config);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ provider, config: agentConfig });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Coding Agent
        </CardTitle>
        <CardDescription>
          ACP/A2A agent that reads the error, modifies source code, and returns a fix. Used for all code modification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider" className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />Provider
            </Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acp">ACP Agent (OpenCode / Claude Code)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The Coding Agent that reads and modifies source files</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="config" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />Agent Config
            </Label>
            <Input id="config" value={agentConfig} onChange={(e) => setAgentConfig(e.target.value)} placeholder="opencode_binary=opencode;timeout_ms=120000" className="font-mono" />
            <p className="text-xs text-muted-foreground">Key=value pairs separated by semicolons</p>
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}