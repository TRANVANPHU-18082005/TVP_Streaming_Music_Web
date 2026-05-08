import { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  Palette,
  Volume2,
  LogOut,
  Check,
  Sparkles,
  Moon,
  Monitor,
  Sun,
  ChevronRight,
  Globe,
  Save,
  Camera,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useTheme, type Skin, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — only the 8 skins registered in index.css [data-theme] selectors
// ─────────────────────────────────────────────────────────────────────────────

const SKINS: { id: Skin; label: string; color: string; desc: string }[] = [
  // ── 8 theme cũ (giữ id, cập nhật color HSL từ v4) ──
  {
    id: "tokyo",
    label: "Tokyo Night",
    color: "hsl(340 92% 70%)",
    desc: "Neon Cyberpunk",
  },
  {
    id: "sahara",
    label: "Sahara Gold",
    color: "hsl(38 96% 58%)",
    desc: "Luxury Amber",
  },
  {
    id: "nordic",
    label: "Nordic Ice",
    color: "hsl(199 95% 68%)",
    desc: "Arctic Minimal",
  },
  {
    id: "amazon",
    label: "Forest Zen",
    color: "hsl(152 70% 58%)",
    desc: "Emerald Calm",
  },
  {
    id: "crimson",
    label: "Crimson Abyss",
    color: "hsl(351 90% 62%)",
    desc: "Ruby Passion",
  },
  {
    id: "vapor",
    label: "Vaporwave",
    color: "hsl(286 94% 74%)",
    desc: "80s Dream",
  },
  {
    id: "slate",
    label: "Midnight Slate",
    color: "hsl(215 30% 78%)",
    desc: "Pro Steel Gray",
  },
  {
    id: "arctic",
    label: "Arctic Light",
    color: "hsl(258 82% 72%)",
    desc: "Obsidian Contrast",
  },

  // ── 4 theme v3 bổ sung ──
  {
    id: "ocean",
    label: "Deep Ocean",
    color: "hsl(213 100% 62%)",
    desc: "Mysterious Bold",
  },
  {
    id: "rose",
    label: "Rose Gold",
    color: "hsl(348 82% 74%)",
    desc: "Elegant Feminine",
  },
  {
    id: "lime",
    label: "Neon Lime",
    color: "hsl(82 92% 62%)",
    desc: "High Energy",
  },
  {
    id: "mono",
    label: "Obsidian Mono",
    color: "hsl(0 0% 92%)",
    desc: "Ghostly Minimal",
  },

  // ── 5 theme mới v4 ──
  {
    id: "aurora",
    label: "Aurora Borealis",
    color: "hsl(168 90% 58%)",
    desc: "Northern Lights",
  },
  {
    id: "ember",
    label: "Ember Forge",
    color: "hsl(22 100% 64%)",
    desc: "Industrial Fire",
  },
  {
    id: "galaxy",
    label: "Galaxy Core",
    color: "hsl(234 78% 76%)",
    desc: "Deep Space Indigo",
  },
  {
    id: "matcha",
    label: "Matcha Stone",
    color: "hsl(142 60% 66%)",
    desc: "Japanese Zen",
  },
  {
    id: "dusk",
    label: "Dusk Opal",
    color: "hsl(292 82% 76%)",
    desc: "Sunset Iridescent",
  },
];

const MODES: {
  id: Theme;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  { id: "light", label: "Light", icon: Sun, desc: "Clean & bright" },
  { id: "dark", label: "Dark", icon: Moon, desc: "Obsidian abyss" },
  { id: "system", label: "System", icon: Monitor, desc: "Follow device" },
];

type SectionId =
  | "account"
  | "appearance"
  | "playback"
  | "notifications"
  | "privacy";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  { id: "account", label: "Account", icon: User, desc: "Profile & Security" },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    desc: "Themes & Skins",
  },
  { id: "playback", label: "Playback", icon: Volume2, desc: "Audio Quality" },
  { id: "notifications", label: "Alerts", icon: Bell, desc: "Push & Email" },
  { id: "privacy", label: "Privacy", icon: Shield, desc: "Data Safety" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOTION VARIANTS — aligned with --ease-snappy / --ease-spring tokens
// ─────────────────────────────────────────────────────────────────────────────
const TAB_VARIANTS = {
  enter: { opacity: 0, x: 16, filter: "blur(4px)" },
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    x: -12,
    filter: "blur(2px)",
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION NAV ITEM — extracted for memo
// ─────────────────────────────────────────────────────────────────────────────
const SectionNavItem = memo(
  ({
    section,
    isActive,
    onClick,
    index,
  }: {
    section: (typeof SECTIONS)[number];
    isActive: boolean;
    onClick: () => void;
    index: number;
  }) => (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      aria-controls={`settings-panel-${section.id}`}
      className={cn(
        "group w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4",
        "rounded-2xl border text-left",
        "transition-all duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[hsl(var(--ring))]",
        "animate-fade-up",
        isActive
          ? ["bg-card border-border/50 text-primary", "shadow-elevated"]
          : [
              "border-transparent text-foreground",
              "hover:bg-surface-2/70 hover:border-border/30",
            ],
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon container */}
      <div
        className={cn(
          "size-9 sm:size-10 rounded-xl flex items-center justify-center shrink-0",
          "transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-glow-xs"
            : "bg-muted/30 text-muted-foreground group-hover:bg-muted/50",
        )}
      >
        <section.icon size={18} aria-hidden="true" />
      </div>

      {/* Labels — hidden on very small mobile, shown sm+ */}
      <div className="hidden sm:block text-left flex-1 min-w-0">
        <p className="font-semibold text-[14px] leading-tight truncate">
          {section.label}
        </p>
        <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
          {section.desc}
        </p>
      </div>

      <ChevronRight
        size={14}
        className={cn(
          "ml-auto shrink-0 text-muted-foreground/50",
          "transition-all duration-200",
          isActive
            ? "opacity-100 translate-x-0"
            : "opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0",
        )}
        aria-hidden="true"
      />
    </button>
  ),
);
SectionNavItem.displayName = "SectionNavItem";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CARD WRAPPER — glass-frosted + shadow-card + consistent padding
// ─────────────────────────────────────────────────────────────────────────────
const SectionCard = memo(
  ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={cn("card-base glass-frosted", "overflow-hidden", className)}
    >
      {children}
    </div>
  ),
);
SectionCard.displayName = "SectionCard";

const SectionCardHeader = ({
  icon: Icon,
  title,
  description,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  iconColor?: string;
}) => (
  <div className="p-6 sm:p-8 pb-4 sm:pb-5">
    <div className="flex items-center gap-3 mb-3">
      <div
        className="size-10 rounded-xl flex items-center justify-center shadow-glow-xs"
        style={{
          background: iconColor
            ? `hsl(var(--primary) / 0.12)`
            : "hsl(var(--muted))",
          color: iconColor ?? "hsl(var(--primary))",
        }}
      >
        <Icon size={20} aria-hidden="true" />
      </div>
      <h2 className="text-display-lg">{title}</h2>
    </div>
    {description && (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE SECTION
// ─────────────────────────────────────────────────────────────────────────────
const AppearanceSection = memo(
  ({
    currentMode,
    currentSkin,
    setTheme,
    setSkin,
  }: {
    currentMode: Theme;
    currentSkin: Skin;
    setTheme: (t: Theme) => void;
    setSkin: (s: Skin) => void;
  }) => (
    <div className="space-y-6">
      {/* Interface Mode */}
      <SectionCard>
        <SectionCardHeader
          icon={Sparkles}
          title="Interface Mode"
          description="Optimized visual experience for every lighting condition."
        />
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const isActive = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setTheme(m.id)}
                aria-pressed={isActive}
                aria-label={`Set ${m.label} mode`}
                className={cn(
                  "pressable flex flex-col items-center gap-3 p-4 sm:p-6 rounded-2xl border-2",
                  "transition-all duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  "focus-visible:outline-[hsl(var(--ring))]",
                  isActive
                    ? "bg-primary/6 border-primary shadow-brand"
                    : "bg-surface-1/60 border-border/40 hover:border-primary/25 hover:bg-surface-2/60",
                )}
              >
                <div
                  className={cn(
                    "size-11 rounded-full flex items-center justify-center",
                    "transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-glow-sm"
                      : "bg-muted/30 text-muted-foreground",
                  )}
                >
                  <m.icon size={22} aria-hidden="true" />
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "font-bold text-xs uppercase tracking-wider leading-none",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {m.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    {m.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Skin Grid */}
      <SectionCard>
        <SectionCardHeader
          icon={Palette}
          title="Color Skins"
          description="Adaptive Color system auto-adjusts saturation per theme mode."
        />
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {SKINS.map((s, i) => {
            const isActive = currentSkin === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSkin(s.id)}
                aria-pressed={isActive}
                aria-label={`Apply ${s.label} skin`}
                className={cn(
                  "group pressable flex items-center gap-3.5 p-3.5 rounded-2xl border",
                  "transition-all duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  "focus-visible:outline-[hsl(var(--ring))]",
                  "animate-fade-up",
                  isActive
                    ? "bg-primary/6 border-primary/40 shadow-glow-xs"
                    : "bg-surface-1/60 border-border/40 hover:bg-surface-2/70 hover:border-border-strong",
                )}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                {/* Color swatch */}
                <div
                  className="size-9 rounded-xl shrink-0 flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                >
                  {isActive && (
                    <Check className="size-4 text-white drop-shadow" />
                  )}
                </div>
                <div className="text-left truncate min-w-0">
                  <p
                    className={cn(
                      "font-semibold text-sm leading-tight truncate",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                    {s.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  ),
);
AppearanceSection.displayName = "AppearanceSection";

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT SECTION
// ─────────────────────────────────────────────────────────────────────────────
const AccountSection = memo(() => (
  <SectionCard>
    {/* Hero banner — gradient-brand token */}
    <div
      className="h-28 sm:h-36 gradient-brand opacity-30"
      aria-hidden="true"
    />

    <div className="px-6 sm:px-8 pb-8">
      {/* Avatar + name row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 -mt-10 sm:-mt-14 mb-8">
        <div className="relative group size-24 sm:size-28 rounded-[28px] sm:rounded-[32px] shrink-0">
          {/* Avatar frame — card-base tokens */}
          <div className="size-full rounded-[inherit] bg-card border-2 border-border/60 shadow-card-md flex items-center justify-center overflow-hidden">
            <User
              size={44}
              className="text-muted-foreground/30"
              aria-hidden="true"
            />
          </div>
          {/* Hover overlay */}
          <button
            className={cn(
              "absolute inset-0 rounded-[inherit]",
              "bg-overlay/70 backdrop-blur-sm",
              "flex flex-col items-center justify-center gap-1",
              "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              "transition-opacity duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-[hsl(var(--ring))]",
            )}
            aria-label="Change profile photo"
          >
            <Camera size={20} className="text-white" aria-hidden="true" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Change
            </span>
          </button>
        </div>

        <div className="pb-1 sm:pb-2 min-w-0">
          <h3 className="text-2xl font-black tracking-tight text-foreground truncate">
            Soundwave User
          </h3>
          <p
            className="text-xs font-bold uppercase tracking-widest mt-1"
            style={{ color: "hsl(var(--primary))" }}
          >
            Premium Member
          </p>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <div className="space-y-2">
          <label className="text-overline text-muted-foreground/60 ml-0.5">
            Username
          </label>
          <Input
            className="input-base h-11"
            defaultValue="Neural_Artist_01"
            aria-label="Username"
          />
        </div>

        <div className="space-y-2">
          <label className="text-overline text-muted-foreground/60 ml-0.5">
            Email
          </label>
          <Input
            className="input-base h-11 opacity-70 cursor-not-allowed"
            defaultValue="user@soundwave.io"
            readOnly
            aria-label="Email address (read-only)"
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-overline text-muted-foreground/60 ml-0.5">
            Biography
          </label>
          <Textarea
            className="input-base min-h-[110px] resize-none py-3"
            placeholder="Tell us about your musical taste…"
            aria-label="Biography"
          />
        </div>
      </div>

      {/* Save CTA — .btn-primary from design system */}
      <button className="btn-primary btn-lg mt-8 gap-2.5">
        <Save size={16} aria-hidden="true" />
        Save Profile
      </button>
    </div>
  </SectionCard>
));
AccountSection.displayName = "AccountSection";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK SECTION
// ─────────────────────────────────────────────────────────────────────────────
const PlaybackSection = memo(
  ({
    audioQuality,
    setAudioQuality,
    normalize,
    setNormalize,
  }: {
    audioQuality: number[];
    setAudioQuality: (v: number[]) => void;
    normalize: boolean;
    setNormalize: (v: boolean) => void;
  }) => (
    <SectionCard>
      <SectionCardHeader
        icon={Volume2}
        title="Audio Fidelity"
        description="Configure streaming quality and Neural Audio Engine settings."
      />
      <div className="px-6 sm:px-8 pb-8 space-y-8">
        {/* Quality slider */}
        <div className="space-y-5">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-base text-foreground">
                Streaming Quality
              </p>
              <p className="text-sm text-muted-foreground">
                Higher quality uses more data.
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <span
                className="text-display-lg tabular-nums"
                style={{ color: "hsl(var(--primary))" }}
              >
                {audioQuality[0]}
              </span>
              <span className="text-overline text-muted-foreground/60 ml-1">
                KBPS
              </span>
            </div>
          </div>

          <Slider
            value={audioQuality}
            onValueChange={setAudioQuality}
            max={320}
            min={96}
            step={32}
            className="cursor-grab active:cursor-grabbing"
            aria-label="Streaming quality in kbps"
          />

          {/* Quality markers */}
          <div className="flex justify-between px-1">
            {[96, 128, 160, 192, 256, 320].map((v) => (
              <span
                key={v}
                className={cn(
                  "text-[10px] font-mono tabular-nums",
                  audioQuality[0] === v
                    ? "text-primary font-bold"
                    : "text-muted-foreground/40",
                )}
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        <Separator style={{ background: "hsl(var(--border) / 0.4)" }} />

        {/* Toggle options */}
        <div className="space-y-5">
          {[
            {
              id: "normalize",
              label: "Normalize Volume",
              desc: "Auto-balance loudness across your entire library.",
              checked: normalize,
              onChange: setNormalize,
            },
            {
              id: "crossfade",
              label: "Crossfade Tracks",
              desc: "Blend between songs during playback (5s transition).",
              checked: true,
              onChange: () => {},
            },
            {
              id: "gapless",
              label: "Gapless Playback",
              desc: "Remove silence between tracks in albums.",
              checked: false,
              onChange: () => {},
            },
          ].map((item, i) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between gap-4 py-1",
                "animate-fade-up",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label
                  htmlFor={item.id}
                  className="text-[15px] font-semibold text-foreground cursor-pointer"
                >
                  {item.label}
                </Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                id={item.id}
                checked={item.checked}
                onCheckedChange={item.onChange}
                aria-label={item.label}
              />
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  ),
);
PlaybackSection.displayName = "PlaybackSection";

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER SECTION — for Notifications & Privacy
// ─────────────────────────────────────────────────────────────────────────────
const PlaceholderSection = memo(
  ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
  }) => (
    <SectionCard>
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-5">
        <div
          className="size-16 rounded-2xl flex items-center justify-center shadow-glow-xs"
          style={{
            background: "hsl(var(--primary) / 0.10)",
            color: "hsl(var(--primary))",
          }}
        >
          <Icon size={28} aria-hidden="true" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-display-lg">{title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
        <div className="badge badge-muted mt-2">Coming Soon</div>
      </div>
    </SectionCard>
  ),
);
PlaceholderSection.displayName = "PlaceholderSection";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const {
    theme: currentMode,
    skin: currentSkin,
    setTheme,
    setSkin,
  } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>("account");
  const [audioQuality, setAudioQuality] = useState([320]);
  const [normalize, setNormalize] = useState(true);

  const handleSetSection = useCallback(
    (id: SectionId) => () => setActiveSection(id),
    [],
  );

  return (
    <div className="relative min-h-screen bg-background pb-24">
      {/* ── Ambient orbs — token-driven, skin-aware ── */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden -z-10"
        aria-hidden="true"
      >
        <div className="orb-float orb-float--brand orb-float--lg absolute -top-32 -right-32 size-[500px] opacity-[0.12]" />
        <div className="orb-float orb-float--wave orb-float--slow absolute bottom-0 -left-32 size-[400px] opacity-[0.07]" />
        <div className="orb-float orb-float--fast absolute top-1/2 left-1/2 size-[300px] opacity-[0.05]" />
      </div>

      <div className="section-container py-10 lg:py-16">
        {/* ── Page Header ── */}
        <header className="mb-10 animate-fade-up">
          <h1 className="text-display-xl text-brand mb-3">Settings</h1>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
          {/* ── Sidebar Navigation ── */}
          <aside
            className="lg:w-72 xl:w-80 shrink-0"
            aria-label="Settings navigation"
          >
            {/*
             * Mobile: horizontal scrollable strip
             * lg+: vertical list
             */}
            <div
              className={cn(
                // Mobile: horizontal scroll
                "flex flex-row lg:flex-col gap-2",
                "overflow-x-auto lg:overflow-x-visible",
                "pb-2 lg:pb-0",
                "no-scrollbar",
                // Fade edges on mobile
                "scroll-overflow-mask lg:[mask-image:none]",
              )}
              role="tablist"
              aria-label="Settings sections"
            >
              {SECTIONS.map((section, i) => (
                <div
                  key={section.id}
                  className="shrink-0 lg:shrink w-auto lg:w-full"
                >
                  <SectionNavItem
                    section={section}
                    isActive={activeSection === section.id}
                    onClick={handleSetSection(section.id)}
                    index={i}
                  />
                </div>
              ))}
            </div>

            {/* Infrastructure panel — .glass from design system */}
            <div
              className={cn(
                "hidden lg:block mt-6 p-5 rounded-2xl glass",
                "space-y-3 animate-fade-up delay-400",
              )}
            >
              <p className="text-overline text-muted-foreground/45 px-1">
                Infrastructure
              </p>
              <div className="space-y-1">
                <button
                  className={cn(
                    "btn-ghost w-full justify-start gap-3 h-11 rounded-xl text-sm font-medium",
                  )}
                >
                  <Globe size={15} aria-hidden="true" />
                  Language
                  <span
                    className="ml-auto text-xs font-mono"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    EN (UTF-8)
                  </span>
                </button>

                <button
                  className={cn(
                    "btn-ghost w-full justify-start gap-3 h-11 rounded-xl text-sm font-medium",
                    // Danger color via token
                    "text-[hsl(var(--error))] hover:bg-[hsl(var(--error)/0.08)] hover:text-[hsl(var(--error))]",
                  )}
                >
                  <LogOut size={15} aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <main className="flex-1 min-w-0" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                variants={TAB_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                id={`settings-panel-${activeSection}`}
                role="tabpanel"
                aria-label={SECTIONS.find((s) => s.id === activeSection)?.label}
              >
                {activeSection === "account" && <AccountSection />}

                {activeSection === "appearance" && (
                  <AppearanceSection
                    currentMode={currentMode}
                    currentSkin={currentSkin}
                    setTheme={setTheme}
                    setSkin={setSkin}
                  />
                )}

                {activeSection === "playback" && (
                  <PlaybackSection
                    audioQuality={audioQuality}
                    setAudioQuality={setAudioQuality}
                    normalize={normalize}
                    setNormalize={setNormalize}
                  />
                )}

                {activeSection === "notifications" && (
                  <PlaceholderSection
                    icon={Bell}
                    title="Notification Center"
                    description="Push and email alert preferences are coming in the next release."
                  />
                )}

                {activeSection === "privacy" && (
                  <PlaceholderSection
                    icon={Shield}
                    title="Privacy & Data"
                    description="Data safety controls and export tools are being finalized."
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
