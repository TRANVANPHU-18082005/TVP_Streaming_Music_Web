import React, { useMemo, useCallback } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/config/constants";
import {
  Music,
  CornerDownRight,
  FolderTree,
  Layers,
  ListMusic,
  TrendingUp,
  PenSquare,
  Trash2,
  ExternalLink,
  EyeOff,
  Eye,
  MoreVertical,
  RotateCcw,
} from "lucide-react";
import { IGenre } from "@/features/genre";

export type GenreRowProps = {
  genre: IGenre;
  index: number;
  page: number;
  pageSize: number;
  onEdit: (g: IGenre) => void;
  onAskDelete: (g: IGenre) => void;
  onRestore?: (g: IGenre) => void;
  onResetParent?: (g: IGenre) => void;
  onToggleStatus: (g: IGenre) => void;
  isMutating: boolean;
};

export const GenreRow = React.memo(function GenreRow({
  genre,
  index,
  page,
  pageSize,
  onEdit,
  onAskDelete,
  onRestore: _onRestore,
  onResetParent: _onResetParent,
  onToggleStatus,
  isMutating,
}: GenreRowProps) {
  const parent = (genre.parentId as IGenre) || null;

  const displayIndex = useMemo(
    () =>
      String(
        (page - 1) * (pageSize || APP_CONFIG.PAGINATION_LIMIT) + index + 1,
      ).padStart(2, "0"),
    [page, pageSize, index],
  );

  const progressWidth = useMemo(
    () => Math.min((genre.trackCount || 0) * 2, 100),
    [genre.trackCount],
  );

  const progressStyle = useMemo(
    () => ({ width: `${progressWidth}%` }),
    [progressWidth],
  );
  const dotStyle = useMemo(
    () => ({ backgroundColor: genre.color || "#CBD5E1" }),
    [genre.color],
  );

  const handleEditClick = useCallback(() => onEdit(genre), [onEdit, genre]);
  const handleToggleClick = useCallback(
    () => onToggleStatus(genre),
    [onToggleStatus, genre],
  );
  const handleAskDeleteClick = useCallback(
    () => onAskDelete(genre),
    [onAskDelete, genre],
  );

  return (
    <TableRow className="group hover:bg-muted/40 transition-colors duration-150 border-b last:border-0">
      {/* INDEX */}
      <TableCell className="text-center">
        <span className="font-mono text-[11px] text-muted-foreground/50 font-medium">
          {displayIndex}
        </span>
      </TableCell>

      {/* IDENTITY */}
      <TableCell>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="size-12 rounded-xl overflow-hidden border-2 border-background shadow-md bg-muted group-hover:scale-105 transition-transform duration-300">
              {genre.image ? (
                <img
                  src={genre.image}
                  alt={genre.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/5">
                  <Music className="size-5 text-primary/30" />
                </div>
              )}
            </div>
            <div
              className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background shadow-sm"
              style={dotStyle}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <Link
              to={`/genres/${genre.slug || genre._id}`}
              className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate flex items-center gap-1.5"
            >
              {genre.name}
              {genre.parentId && (
                <CornerDownRight className="size-3 text-muted-foreground/40" />
              )}
            </Link>
            <span className="text-[11px] text-muted-foreground line-clamp-1 italic">
              {genre.description || "No description provided"}
            </span>
          </div>
        </div>
      </TableCell>

      {/* HIERARCHY */}
      <TableCell className="text-center">
        {parent ? (
          <Badge
            variant="outline"
            className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/20 font-medium transition-colors"
          >
            <FolderTree className="size-3 mr-1.5" /> {parent.name}
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="bg-muted/50 text-muted-foreground/60 border-transparent font-normal"
          >
            <Layers className="size-3 mr-1.5 opacity-40" /> Master
          </Badge>
        )}
      </TableCell>

      {/* METRICS */}
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <ListMusic className="size-3 text-primary" />
            <span>{genre.trackCount || 0} Tracks</span>
          </div>
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/40 transition-all duration-1000"
              style={progressStyle}
            />
          </div>
        </div>
      </TableCell>

      {/* DISCOVERY */}
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-muted-foreground/50">
            RANK: {genre.priority || 0}
          </span>
          {genre.isTrending && (
            <div className="flex items-center text-[9px] font-black text-orange-500 bg-orange-500/10 w-fit px-2 py-0.5 rounded-full border border-orange-500/20 shadow-sm animate-pulse">
              <TrendingUp className="size-2.5 mr-1" /> TRENDING
            </div>
          )}
        </div>
      </TableCell>

      {/* VISIBILITY */}
      <TableCell>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm transition-all",
            genre.isActive
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20",
          )}
        >
          <div
            className={cn(
              "size-1.5 rounded-full",
              genre.isActive ? "bg-emerald-500 shadow-sm" : "bg-destructive/30",
            )}
            style={dotStyle}
          />
          {genre.isActive ? "PUBLISHED" : "HIDDEN"}
        </div>
      </TableCell>

      {/* ACTIONS */}
      <TableCell className="text-right pr-6">
        <div className="flex items-center justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEditClick}
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-primary hover:bg-primary/5"
                >
                  <PenSquare className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 transition-colors active:bg-muted"
              >
                <MoreVertical className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 p-1.5 shadow-xl border-border/50"
            >
              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground/60 px-2 py-2">
                Management
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={handleEditClick}
                className="rounded-lg cursor-pointer"
              >
                <ExternalLink className="mr-2 size-4 text-primary" /> View
                Analytics
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleToggleClick}
                className="rounded-lg cursor-pointer"
                disabled={isMutating}
              >
                {genre.isActive ? (
                  <>
                    <EyeOff className="mr-2 size-4 text-orange-500" /> Archive
                    Genre
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 size-4 text-emerald-500" /> Publish
                    Genre
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1.5" />

              {/* Quick reset parent action: visible only when this genre has a parent */}
              {genre.parentId && (
                <DropdownMenuItem
                  onClick={() => _onResetParent && _onResetParent(genre)}
                  className="rounded-lg cursor-pointer"
                  disabled={isMutating}
                >
                  <RotateCcw className="mr-2 size-4 text-muted-foreground" />
                  Unset Parent
                </DropdownMenuItem>
              )}

              {genre.isDeleted ? (
                <DropdownMenuItem
                  onClick={() => _onRestore && _onRestore(genre)}
                  className="rounded-lg cursor-pointer text-success"
                >
                  <RotateCcw className="mr-2 size-4" /> Restore Genre
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={handleAskDeleteClick}
                  className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                  disabled={isMutating}
                >
                  <Trash2 className="mr-2 size-4" /> Permanent Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});

GenreRow.displayName = "GenreRow";

export default GenreRow;
