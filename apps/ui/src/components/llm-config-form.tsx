import { useState } from "react";
import type { LLMConfig } from "@xartifact/x-tinker-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Brain, Globe, Key, Thermometer, Hash } from "lucide-react";

const KNOWN_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"], defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest"], defaultBaseUrl: "https://api.anthropic.com/v1" },
  { id: "ollama", label: "Ollama", models: ["llama3", "qwen2.5-coder"], defaultBaseUrl: "http://localhost:11434/v1" },
];

interface Props {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  saving: boolean;
}

export function LLMConfigForm({ config, onSave, saving }: Props) {
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl ?? "");
  const [maxTokens, setMaxTokens] = useState(config.maxTokens ?? 2048);
  const [temperature, setTemperature] = useState(config.temperature ?? 0.1);

  const selected = KNOWN_PROVIDERS.find((p) => p.id === provider);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ provider, model, apiKey, baseUrl, maxTokens, temperature });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          LLM (Analysis & Classification)
        </CardTitle>
        <CardDescription>Used for non-coding tasks like error analysis and summarization. Code modification is handled by the Coding Agent.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={(v) => { setProvider(v); setModel(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KNOWN_PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {selected?.models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />API Key
              </Label>
              <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />Base URL
              </Label>
              <Input id="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono" placeholder={selected?.defaultBaseUrl ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxTokens" className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />Max Tokens
              </Label>
              <Input id="maxTokens" type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature" className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-muted-foreground" />Temperature
              </Label>
              <Input id="temperature" type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
            </div>
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}