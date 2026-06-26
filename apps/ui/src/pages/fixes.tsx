import { trpc } from "../trpc";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Bug, CheckCircle, XCircle, Clock } from "lucide-react";

const statusIcon: Record<string, typeof Bug> = {
  failed: XCircle,
  verified: CheckCircle,
  pending: Clock,
  applied: Clock,
  rejected: XCircle,
};

const statusColor: Record<string, string> = {
  failed: "destructive",
  verified: "default",
  pending: "secondary",
  applied: "secondary",
  rejected: "destructive",
};

function statusBadge(status: string) {
  const Icon = statusIcon[status] ?? Bug;
  const variant = (statusColor[status] ?? "secondary") as "default" | "secondary" | "destructive";
  return (
    <Badge variant={variant} className="gap-1 capitalize">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

export function FixesPage() {
  const { data, isLoading, error } = trpc.events.list.useQuery({ limit: 50 });

  if (isLoading) return <div className="text-muted-foreground p-4">Loading events...</div>;
  if (error) return <div className="text-destructive p-4">Error: {error.message}</div>;

  const items = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fix History</h1>
        <p className="text-muted-foreground mt-1">Recently received error events and their fix results</p>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No events yet. Errors reported to x-tinker will appear here.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map(({ event, fix }) => (
          <Card key={event.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug className="h-4 w-4 text-destructive" />
                    {event.errorType}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-mono">{event.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fix ? statusBadge(fix.status) : statusBadge("pending")}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>Project: {event.projectId}</span>
                <span>File: {event.sourceContext.filePath}:{event.sourceContext.line}</span>
                <span className="font-mono">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              {fix && fix.patch.files.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Files changed: {fix.patch.files.join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}