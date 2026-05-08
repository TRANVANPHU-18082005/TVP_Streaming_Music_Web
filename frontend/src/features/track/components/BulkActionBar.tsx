import React from "react";
import {
  X,
  Disc,
  Tags,
  Trash2,
  CheckCircle2,
  RefreshCw,
  FileText,
  Video,
  Sparkles,
  Layers,
  Globe,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onEditAlbum: () => void;
  onEditMetadata: () => void;
  onEditLegal?: () => void;
  onDelete: () => void;
  onRetryTranscode?: () => void;
  onRetryLyrics?: () => void;
  onRetryKaraoke?: () => void;
  onRetryMood?: () => void;
  onRetryFull?: () => void;
  onTogglePublic?: () => void;
  onToggleExplicit?: () => void;
  onChangeStatus?: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClear,
  onEditAlbum,
  onRetryLyrics,
  onRetryMood,
  onRetryKaraoke,
  onRetryTranscode,
  onRetryFull,
  onEditMetadata,
  onDelete,
  onTogglePublic,
  onToggleExplicit,
  onChangeStatus,
  onEditLegal,
}) => {
  if (selectedCount === 0) return null;

  return (
    // Z-INDEX: 40 (Thấp hơn Modal thường là 50)
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full px-4 flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
      <div className="bg-foreground text-background pointer-events-auto rounded-full shadow-2xl p-2 pr-3 flex items-center gap-2 sm:gap-4 border border-border/10 ring-1 ring-white/10 max-w-full overflow-x-auto no-scrollbar">
        {/* === Left: Info & Clear === */}
        <div className="flex items-center gap-2 pl-1">
          <div className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-bold text-xs shadow-sm select-none whitespace-nowrap">
            <CheckCircle2 className="size-3.5 fill-current" />
            <span>{selectedCount}</span>
            <span className="hidden sm:inline">đã chọn</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="text-background/60 hover:text-background hover:bg-background/20 size-8 rounded-full shrink-0"
            title="Bỏ chọn"
          >
            <X className="size-4 stroke-[3]" />
          </Button>
        </div>

        <Separator
          orientation="vertical"
          className="h-6 bg-background/20 hidden sm:block"
        />

        {/* === Right: Actions === */}
        <div className="flex items-center gap-1">
          {/* Publishing Actions */}
          {onTogglePublic && (
            <ActionButton
              icon={<Globe className="size-4" />}
              label="Public"
              onClick={onTogglePublic}
            />
          )}
          {onToggleExplicit && (
            <ActionButton
              icon={<ShieldCheck className="size-4" />}
              label="Explicit"
              onClick={onToggleExplicit}
            />
          )}

          <div className="mx-1 w-px h-5 bg-background/20 block" />

          {/* Metadata Actions */}
          <ActionButton
            icon={<Disc className="size-4" />}
            label="Album"
            onClick={onEditAlbum}
          />
          <ActionButton
            icon={<Tags className="size-4" />}
            label="Metadata"
            onClick={onEditMetadata}
          />
          {onEditLegal && (
            <ActionButton
              icon={<FileText className="size-4" />}
              label="Legal"
              onClick={onEditLegal}
            />
          )}

          {/* Status Action */}
          {onChangeStatus && (
            <>
              <ActionButton
                icon={<CheckCircle2 className="size-4" />}
                label="Status"
                onClick={onChangeStatus}
              />
              <div className="mx-1 w-px h-5 bg-background/20 block" />
            </>
          )}

          {/* Retry Actions */}
          {(onRetryTranscode ||
            onRetryLyrics ||
            onRetryKaraoke ||
            onRetryMood ||
            onRetryFull) && (
            <>
              {onRetryTranscode && (
                <ActionButton
                  icon={<RefreshCw className="size-4" />}
                  label="Retranscode"
                  onClick={onRetryTranscode}
                />
              )}
              {onRetryLyrics && (
                <ActionButton
                  icon={<FileText className="size-4" />}
                  label="Retry Lyrics"
                  onClick={onRetryLyrics}
                />
              )}
              {onRetryKaraoke && (
                <ActionButton
                  icon={<Video className="size-4" />}
                  label="Retry Karaoke"
                  onClick={onRetryKaraoke}
                />
              )}
              {onRetryMood && (
                <ActionButton
                  icon={<Sparkles className="size-4" />}
                  label="Retry Mood"
                  onClick={onRetryMood}
                />
              )}
              {onRetryFull && (
                <ActionButton
                  icon={<Layers className="size-4" />}
                  label="Retry Full"
                  onClick={onRetryFull}
                />
              )}

              <div className="mx-1 w-px h-5 bg-background/20 block" />
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-300 hover:text-white hover:bg-destructive gap-2 h-9 rounded-full px-3 sm:px-4 transition-all group shrink-0"
          >
            <Trash2 className="size-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-bold">Xóa</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <Button
    variant="ghost"
    size="sm"
    className="text-background font-semibold hover:bg-background gap-2 h-9 rounded-full px-3 transition-all active:scale-95 shrink-0"
    onClick={onClick}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </Button>
);
export default BulkActionBar;
