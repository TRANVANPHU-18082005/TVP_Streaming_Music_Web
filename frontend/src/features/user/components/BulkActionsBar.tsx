import React from "react";
import { Lock, Unlock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBlockSelected: () => void;
  onUnblockSelected: () => void;
  onDeleteSelected: () => void;
  isPending?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClearSelection,
  onBlockSelected,
  onUnblockSelected,
  onDeleteSelected,
  isPending = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="bg-background/80 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 min-w-[320px] max-w-[90vw] overflow-x-auto ring-1 ring-primary/10">
        
        {/* Selection Info */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="default" className="bg-primary text-primary-foreground text-sm font-bold h-7 px-3">
            {selectedCount} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isPending}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4 mr-1.5" />
            Clear
          </Button>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onBlockSelected}
            disabled={isPending}
            className="h-9 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/50 dark:text-amber-500 dark:hover:text-amber-400"
          >
            <Lock className="size-4 mr-2" />
            Block
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onUnblockSelected}
            disabled={isPending}
            className="h-9 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-500/50 dark:text-emerald-500 dark:hover:text-emerald-400"
          >
            <Unlock className="size-4 mr-2" />
            Unblock
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={isPending}
            className="h-9 shadow-sm"
          >
            <Trash2 className="size-4 mr-2" />
            Delete All
          </Button>
        </div>

      </div>
    </div>
  );
};
