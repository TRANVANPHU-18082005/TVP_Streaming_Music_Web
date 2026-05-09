import React, { useCallback, useEffect, useRef, useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { LONG_PRESS_MS, prefersReducedMotion } from "@/utils/playerLayout";

interface TrackRowShellProps {
  id?: string;
  ariaLabel?: string;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  isSelected?: boolean;
  onPlay?: (e?: React.MouseEvent) => void;
  onSelect?: (id: string, mode: "single" | "range" | "toggle") => void;
  onContextMenu?: (anchor: HTMLElement) => void;
  onNavigate?: (direction: "up" | "down") => void;
  animationDelay?: number;
  left?: React.ReactNode;
  center?: React.ReactNode;
  album?: React.ReactNode;
  actions?: React.ReactNode;
  duration?: React.ReactNode;
}

export const TrackRowShell = ({
  id,
  ariaLabel,
  isActive,
  isSelected = false,
  onPlay,
  onSelect,
  onContextMenu,
  onNavigate,
  animationDelay = 0,
  left,
  center,
  album,
  actions,
  duration,
}: TrackRowShellProps) => {
  const rowRef = useRef<HTMLTableRowElement>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button'], [data-no-row-click]"))
        return;

      if ((e.ctrlKey || e.metaKey) && onSelect && id) {
        onSelect(id, "toggle");
      } else if (e.shiftKey && onSelect && id) {
        onSelect(id, "range");
      } else {
        onPlay?.(e);
      }
    },
    [onPlay, onSelect, id],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          onPlay?.();
          break;
        case " ":
          e.preventDefault();
          onPlay?.();
          break;
        case "ArrowUp":
          e.preventDefault();
          onNavigate?.("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          onNavigate?.("down");
          break;
        case "Escape":
          rowRef.current?.blur();
          break;
      }
    },
    [onPlay, onNavigate],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (!onContextMenu) return;
      e.preventDefault();
      onContextMenu(e.currentTarget);
    },
    [onContextMenu],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!onContextMenu) return;
      longPressTimer.current = setTimeout(() => {
        onContextMenu(e.currentTarget as HTMLElement);
      }, LONG_PRESS_MS);
    },
    [onContextMenu],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const [hasHovered, setHasHovered] = useState(false);
  const handleMouseEnter = useCallback(() => {
    if (!hasHovered) setHasHovered(true);
  }, [hasHovered]);

  return (
    <TableRow
      ref={rowRef}
      data-active={isActive || undefined}
      data-selected={isSelected || undefined}
      tabIndex={0}
      role="row"
      aria-label={ariaLabel}
      aria-current={isActive ? "true" : undefined}
      aria-selected={isSelected}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      className={cn(
        "group relative h-14 cursor-pointer select-none outline-none",
        "border-b border-border/[0.05] last:border-b-0",
        "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset focus-visible:z-10",
        prefersReducedMotion ? "" : "transition-colors duration-100 ease-out",
        isSelected
          ? "bg-primary/[0.08] hover:bg-primary/[0.11]"
          : isActive
            ? "bg-primary/[0.06] hover:bg-primary/[0.09]"
            : "hover:bg-muted/30",
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <TableCell className="w-12 p-0" role="gridcell">
        <div className="flex h-14 items-center justify-center">{left}</div>
      </TableCell>

      <TableCell className="py-0 pl-1 pr-4" role="gridcell">
        <div className="flex items-center gap-3 min-w-0">{center}</div>
      </TableCell>

      <TableCell className="hidden md:table-cell py-0 pr-4" role="gridcell">
        {album}
      </TableCell>

      <TableCell className="py-0 pr-1 w-10" role="gridcell">
        {hasHovered && actions}
      </TableCell>

      <TableCell className="py-0 pr-3" role="gridcell" data-no-row-click="">
        <div className="flex items-center justify-end">{duration}</div>
      </TableCell>
    </TableRow>
  );
};

export default TrackRowShell;
