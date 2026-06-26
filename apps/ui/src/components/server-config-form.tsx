import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Radio } from "lucide-react";

interface Props {
  config: { port: number };
  onSave: (config: { port: number }) => void;
  saving: boolean;
}

export function ServerConfigForm({ config, onSave, saving }: Props) {
  const [port, setPort] = useState(config.port);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ port });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Server Configuration
        </CardTitle>
        <CardDescription>x-tinker server port. Restart required for this change to take effect.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="port">Port</Label>
            <Input id="port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Server Config"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}