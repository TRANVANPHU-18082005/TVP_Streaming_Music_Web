"use client";

import { useTheme, type Skin } from "@/hooks/useTheme";
import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const SKINS: { id: Skin; label: string; color: string }[] = [
  { id: "obsidian", label: "Obsidian", color: "hsl(255 85% 60%)" },
  { id: "tokyo", label: "Tokyo Night", color: "hsl(340 85% 65%)" },
  { id: "sahara", label: "Sahara Gold", color: "hsl(38 92% 55%)" },
  { id: "nordic", label: "Nordic Ice", color: "hsl(199 89% 65%)" },
  { id: "amazon", label: "Forest Zen", color: "hsl(152 65% 55%)" },
  { id: "crimson", label: "Crimson", color: "hsl(355 85% 55%)" },
  { id: "vapor", label: "Vaporwave", color: "hsl(285 90% 70%)" },
];

export function SkinToggle() {
  const { skin: currentSkin, setSkin } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full border border-transparent hover:bg-accent"
        >
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Change appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Giao diện (Appearance)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-1 gap-1 p-1">
          {SKINS.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setSkin(s.id)}
              className={cn(
                "flex items-center justify-between cursor-pointer rounded-md px-2 py-1.5",
                currentSkin === s.id && "bg-primary/10",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: s.color }}
                />
                <span
                  className={cn(
                    currentSkin === s.id && "font-bold text-primary",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {currentSkin === s.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
