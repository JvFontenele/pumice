import { Save, Users, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  hubOnline: boolean;
  connectedCount: number;
  onSave: () => void;
}

export function StudioHeader({ hubOnline, connectedCount, onSave }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Pumice Studio</h1>
        <p className="text-sm text-muted-foreground">Unified product: agents + flows + contexts + orchestration chat.</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("h-6 px-2", hubOnline ? "text-emerald-400" : "text-red-400")}>
          {hubOnline ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />} Hub
        </Badge>
        <Badge variant="outline" className="h-6 px-2">
          <Users className="mr-1 size-3" />
          {connectedCount}
        </Badge>
        <Button onClick={onSave}>
          <Save className="size-4" />
          Save
        </Button>
      </div>
    </div>
  );
}
