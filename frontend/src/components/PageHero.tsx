import React, { memo } from "react";
import { Disc3 } from "lucide-react";

interface PageHeroProps {
  title: string;
  subtitle: string;
  totalItems: number;
  isLoading: boolean;
  icon?: React.ElementType;
  label?: string;
}

const PageHero = memo(
  ({
    title,
    subtitle,

    icon: Icon = Disc3,
    label = "Collection",
  }: PageHeroProps) => {
    return (
      <header className="section-container pt-12 pb-8 sm:pt-16 sm:pb-12 overflow-hidden">
        <div className="relative z-base">
          {/* Eyebrow - Sử dụng Badge system từ index.css */}
          <div className="flex items-center gap-2 mb-4 animate-fade-up animation-fill-both delay-75">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary shadow-glow-xs border border-primary/20">
              <Icon className="size-4.5 animate-pulse" aria-hidden="true" />
            </div>
            <span className="text-overline text-primary font-bold">
              {label}
            </span>
          </div>

          {/* Title - Gradient wave & Display typography */}
          <h1 className="text-display-2xl text-gradient-wave mb-3 animate-fade-up animation-fill-both delay-100 tracking-tighter">
            {title}
          </h1>

          {/* Subtitle - Optimized line height & readability */}
          <p className="max-w-2xl text-muted-foreground text-lg leading-relaxed mb-6 animate-fade-up animation-fill-both delay-150">
            {subtitle}
          </p>

          {/* Brand Divider - Tokenized from index.css */}
          <div className="divider-glow animate-fade-in animation-fill-both delay-200 w-full max-w-md" />
        </div>

        {/* Ambient background decoration - Phù hợp với Obsidian/Dark mode */}
        <div className="orb-float orb-float--brand orb-float--lg -top-20 -right-20 opacity-20 dark:opacity-10" />
      </header>
    );
  },
);

PageHero.displayName = "PageHero";
export default PageHero;
