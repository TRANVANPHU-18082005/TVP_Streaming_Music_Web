// FilterDropdown.tsx
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterDropdownProps {
  label: React.ReactNode;
  isActive: boolean;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
}

export const FilterDropdown = ({
  label,
  isActive,
  onClear,
  children,
  className,
  contentClassName,
  align = "start",
}: FilterDropdownProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "group h-10 px-3.5 rounded-xl border-input bg-background shadow-sm",
          "transition-all duration-200",
          "hover:bg-accent/50 hover:text-accent-foreground hover:border-accent-foreground/25",
          "data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/12",
          isActive && [
            "bg-primary/10 border-primary/30 text-primary",
            "hover:bg-primary/18 hover:border-primary/45",
            "font-semibold",
          ],
          className,
        )}
      >
        <div className="flex items-center gap-2 max-w-[200px]">
          <span
            className={cn(
              "truncate text-sm tracking-tight transition-colors",
              isActive
                ? "text-primary font-bold"
                : "text-foreground font-medium",
            )}
          >
            {label}
          </span>

          <div className="flex items-center shrink-0">
            {isActive && onClear ? (
              /* * FIX: Thay đổi từ <button> sang <span> với role="button"
               * Để tránh lỗi lồng <button> bên trong <button> (Button của Shadcn)
               */
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear filter"
                onClick={(e) => {
                  e.stopPropagation(); // Ngăn Popover mở ra khi click clear
                  onClear();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClear();
                  }
                }}
                className="ml-1 p-0.5 rounded-full text-primary hover:bg-primary/18 hover:text-destructive transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
              >
                <X className="size-3.5 stroke-[2.5]" aria-hidden="true" />
              </span>
            ) : (
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200 ease-out",
                  "group-data-[state=open]:rotate-180",
                  isActive ? "text-primary" : "text-muted-foreground/65",
                )}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      align={align}
      sideOffset={8}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className={cn(
        "z-[100] p-1.5 overflow-hidden rounded-xl",
        "border border-border bg-popover shadow-lg",
        "animate-in fade-in zoom-in-95 duration-150",
        "w-auto min-w-[240px] max-w-[95vw]",
        contentClassName,
      )}
    >
      <div className="flex flex-col max-h-[400px]">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-0.5">
          {children}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

export default FilterDropdown;
