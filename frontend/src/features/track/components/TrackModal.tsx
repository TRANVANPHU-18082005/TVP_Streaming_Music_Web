import React, {
  useEffect,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Controller, useWatch } from "react-hook-form";
import {
  X,
  Save,
  Camera,
  Globe,
  FileAudio,
  Music,
  Disc,
  ShieldAlert,
  AudioLines,
  AlertCircle,
  Loader2,
  Calendar,
  ListOrdered,
  Type,
  Tags,
  AlignLeft,
  Video,
  Sparkles,
  Languages,
  Info,
  Upload,
  FileText,
  Hash,
  Copyright,
} from "lucide-react";
import { cn } from "@/lib/utils";

// UI Components
import { ArtistSelector } from "@/features/artist/components/ArtistSelector";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
import { AlbumSelector } from "@/features/album/components/AlbumSelector";
import { MoodVideoPicker } from "@/features/mood-video/components/MoodVideoPicker";
import { TagInput } from "@/components/ui/tag-input";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Hooks & Types
import { useTrackForm } from "../hooks/useTrackForm";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface TrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToEdit?: ITrack | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS — all defined at module scope (zero re-creation per render)
// ─────────────────────────────────────────────────────────────────────────────

/** Inline validation error message */
const ErrorMessage = memo(({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div
      className="flex items-center gap-2 mt-2 px-1 text-destructive animate-fade-up animation-fill-both"
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <p className="text-[11px] font-semibold">{message}</p>
    </div>
  );
});
ErrorMessage.displayName = "ErrorMessage";

/** Consistent form field label — matches ProfilePage SectionHeader eyebrow */
const FieldLabel = memo(
  ({
    children,
    required,
    icon: Icon,
    htmlFor,
  }: {
    children: React.ReactNode;
    required?: boolean;
    icon?: React.ElementType;
    htmlFor?: string;
  }) => (
    <Label
      htmlFor={htmlFor}
      className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 w-fit mb-2"
    >
      {Icon && <Icon className="size-3.5 text-primary/70" aria-hidden="true" />}
      {children}
      {required && (
        <span className="text-primary text-xs ml-0.5" aria-label="required">
          *
        </span>
      )}
    </Label>
  ),
);
FieldLabel.displayName = "FieldLabel";

/** Section group header — eyebrow + icon pattern (AlbumPage / ProfilePage) */
const SectionHeader = memo(
  ({
    title,
    description,
    icon: Icon,
  }: {
    title: string;
    description?: string;
    icon: React.ElementType;
  }) => (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center size-8 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-glow-xs shrink-0">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-foreground uppercase tracking-tight leading-none">
          {title}
        </h4>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

/** Horizontal rule with label spacing */
const SectionDivider = memo(() => (
  <div className="divider-glow my-1" aria-hidden="true" />
));
SectionDivider.displayName = "SectionDivider";

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK DROPZONE
// ─────────────────────────────────────────────────────────────────────────────
const ArtworkDropzone = memo(
  ({
    imagePreview,
    onFileChange,
    error,
  }: {
    imagePreview: string | null;
    onFileChange: (file: File | null) => void;
    error?: string;
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => setIsDragging(false), []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) onFileChange(file);
      },
      [onFileChange],
    );

    return (
      <div className="space-y-2">
        <FieldLabel icon={Camera}>Cover Art (1:1)</FieldLabel>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload cover artwork"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative group aspect-square rounded-2xl border-2 border-dashed overflow-hidden",
            "flex items-center justify-center cursor-pointer",
            "transition-all duration-300",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01] shadow-glow-sm"
              : imagePreview
                ? "border-primary/30 shadow-brand"
                : "border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/50",
          )}
        >
          {imagePreview ? (
            <>
              <img
                src={imagePreview}
                alt="Cover art preview"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Hover overlay */}
              <div
                className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                aria-hidden="true"
              >
                <Upload className="size-6 text-background" />
                <span className="text-[11px] font-bold text-background uppercase tracking-widest">
                  Change Art
                </span>
              </div>
            </>
          ) : (
            <div className="text-center p-6 space-y-3 pointer-events-none">
              <div className="size-12 mx-auto bg-muted rounded-2xl flex items-center justify-center">
                <Disc
                  className={cn(
                    "size-6 transition-colors duration-200",
                    isDragging ? "text-primary" : "text-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-muted-foreground/70 tracking-widest">
                  {isDragging ? "Drop here" : "Upload Cover"}
                </p>
                <p className="text-[9px] text-muted-foreground/40">
                  PNG, JPG · Max 5MB
                </p>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden="true"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  },
);
ArtworkDropzone.displayName = "ArtworkDropzone";

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO FILE PICKER
// ─────────────────────────────────────────────────────────────────────────────
const AudioFilePicker = memo(
  ({
    audioName,
    onFileChange,
    error,
  }: {
    audioName: string | null;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
  }) => (
    <div className="space-y-2">
      <FieldLabel required icon={AudioLines}>
        Audio Source
      </FieldLabel>
      <label
        htmlFor="audio-upload"
        className={cn(
          "relative flex items-center gap-4 p-4 rounded-2xl border cursor-pointer",
          "transition-all duration-200 group",
          audioName
            ? "bg-primary/5 border-primary/25 hover:border-primary/45"
            : "bg-card/30 border-border/50 hover:border-primary/35 hover:bg-card/50",
        )}
      >
        {/* Icon / EQ bars */}
        <div
          className={cn(
            "size-11 rounded-xl flex items-center justify-center border shrink-0 transition-all",
            audioName
              ? "bg-primary/15 border-primary/25 text-primary"
              : "bg-muted border-border text-muted-foreground/50",
          )}
          aria-hidden="true"
        >
          {audioName ? (
            /* Animated EQ bars when file selected */
            <div className="eq-bars eq-bars--thin" style={{ height: 18 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="eq-bar" />
              ))}
            </div>
          ) : (
            <FileAudio className="size-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[13px] font-bold truncate leading-tight",
              audioName ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            {audioName || "Select master file"}
          </p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest mt-0.5">
            MP3 · WAV · FLAC · AAC
          </p>
        </div>

        <FileAudio
          className="size-4 text-muted-foreground/25 shrink-0 group-hover:text-primary/50 transition-colors"
          aria-hidden="true"
        />

        <input
          id="audio-upload"
          type="file"
          accept="audio/mp3,audio/wav,audio/aac,audio/flac"
          className="sr-only"
          onChange={onFileChange}
          aria-label="Upload audio file"
        />
      </label>
      <ErrorMessage message={error} />
    </div>
  ),
);
AudioFilePicker.displayName = "AudioFilePicker";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH TOGGLE ROW
// ─────────────────────────────────────────────────────────────────────────────
const PublishToggle = memo(
  ({
    checked,
    onChange,
    icon: Icon,
    label,
    activeClass,
    activeIconClass,
    id,
  }: {
    checked: boolean;
    onChange: () => void;
    icon: React.ElementType;
    label: string;
    activeClass: string;
    activeIconClass: string;
    id: string;
  }) => (
    <div
      className={cn(
        "flex items-center justify-between p-3.5 rounded-xl border",
        "transition-all duration-200",
        checked
          ? activeClass
          : "bg-card/30 border-border/50 hover:border-border",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={cn(
            "size-4 transition-colors",
            checked ? activeIconClass : "text-muted-foreground/60",
          )}
          aria-hidden="true"
        />
        <label
          htmlFor={id}
          className="text-xs font-bold text-foreground cursor-pointer select-none"
        >
          {label}
        </label>
      </div>
      {/* Use Switch as the sole interactive element — no wrapping button/div role */}
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  ),
);
PublishToggle.displayName = "PublishToggle";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK MODAL — Rebuilt for track.schema v3.0
// ─────────────────────────────────────────────────────────────────────────────
const TrackModal = ({
  isOpen,
  onClose,
  trackToEdit,
  onSubmit,
  isPending,
}: TrackModalProps) => {
  const {
    form,
    handleSubmit,
    handleAudioChange,
    imagePreview,
    audioName,
    isSubmitting,
  } = useTrackForm(
    trackToEdit
      ? { mode: "edit", trackToEdit, onSubmit }
      : { mode: "create", onSubmit },
  );

  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = form;

  const isEditing = !!trackToEdit;
  const isLoading = isPending || isSubmitting;

  // Watched values for reactive UI
  const isPublic = useWatch({ control, name: "isPublic" });
  const isExplicit = useWatch({ control, name: "isExplicit" });
  const lyricType = useWatch({ control, name: "lyricType" });
  const trackTags = useWatch({ control, name: "tags" }) ?? [];
  const selectedMainArtist = useWatch({ control, name: "artistId" });
  const mainArtistValue = selectedMainArtist ? [selectedMainArtist] : [];

  // Smart UX callbacks
  const togglePublic = useCallback(
    () =>
      setValue("isPublic", !form.getValues("isPublic"), { shouldDirty: true }),
    [setValue, form],
  );

  const toggleExplicit = useCallback(
    () =>
      setValue("isExplicit", !form.getValues("isExplicit"), {
        shouldDirty: true,
      }),
    [setValue, form],
  );

  const handleCoverChange = useCallback(
    (file: File | null) => {
      setValue("coverImage", file ?? null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [setValue],
  );

  // Body scroll lock with cleanup
  useEffect(() => {
    if (!isOpen) return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  // Canvas tag summary for smart selection
  const tagSummary = useMemo(
    () =>
      trackTags.length
        ? trackTags.slice(0, 4).join(", ") + (trackTags.length > 4 ? "…" : "")
        : "—",
    [trackTags],
  );

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit track" : "Upload new track"}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/50 backdrop-blur-xl animate-fade-in"
        aria-hidden="true"
      />

      {/* Modal shell */}
      <div
        className={cn(
          "relative z-[101] w-full max-w-6xl",
          "bg-background border border-border/60 rounded-3xl",
          "shadow-floating",
          "flex flex-col",
          "max-h-[92vh] sm:max-h-[88vh]",
          "animate-scale-in",
          // NOTE: overflow-hidden intentionally removed — it clips Radix Select/Combobox portals
        )}
      >
        {/* ════ HEADER ════════════════════════════════════════════════════════ */}
        <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border/40 glass-heavy shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-4">
            {/* Icon badge */}
            <div className="relative shrink-0">
              <div
                className={cn(
                  "size-12 rounded-2xl flex items-center justify-center",
                  "bg-primary/10 text-primary border border-primary/20 shadow-glow-xs",
                )}
              >
                {isEditing ? (
                  <Sparkles className="size-6" aria-hidden="true" />
                ) : (
                  <Music className="size-6" aria-hidden="true" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground leading-none">
                  {isEditing ? "Studio Editor" : "New Release"}
                </h3>
                <span className="badge badge-playing text-[9px] font-black uppercase tracking-widest">
                  v3.0 Premium
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
                {isEditing
                  ? `Editing: ${trackToEdit?.title}`
                  : "Upload & distribute to Cloud Audio Network"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-ghost btn-icon size-9 rounded-full text-muted-foreground hover:text-foreground shrink-0"
          >
            <X
              className="size-5 transition-transform duration-200 hover:rotate-90"
              aria-hidden="true"
            />
          </button>
        </header>

        {/* ════ BODY ══════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <form
            id="track-form"
            onSubmit={handleSubmit}
            className="flex flex-col lg:flex-row gap-0"
            noValidate
          >
            {/* ── LEFT SIDEBAR ──────────────────────────────────────────── */}
            <aside
              className={cn(
                "w-full lg:w-[288px] shrink-0",
                "p-6 sm:p-7",
                "border-b lg:border-b-0 lg:border-r border-border/35",
                "space-y-6",
                "bg-surface-1/50",
              )}
              aria-label="Track media and publishing"
            >
              {/* Artwork */}
              <ArtworkDropzone
                imagePreview={imagePreview}
                onFileChange={handleCoverChange}
                error={errors.coverImage?.message as string}
              />

              <SectionDivider />

              {/* Audio */}
              <AudioFilePicker
                audioName={audioName}
                onFileChange={handleAudioChange}
                error={errors.audio?.message as string}
              />

              <SectionDivider />

              {/* Publishing */}
              <div className="space-y-2.5">
                <FieldLabel icon={Globe}>Publishing</FieldLabel>
                <PublishToggle
                  id="publish-public"
                  checked={!!isPublic}
                  onChange={togglePublic}
                  icon={Globe}
                  label="Public Release"
                  activeClass="bg-success/5 border-success/25"
                  activeIconClass="text-success"
                />
                <PublishToggle
                  id="publish-explicit"
                  checked={!!isExplicit}
                  onChange={toggleExplicit}
                  icon={ShieldAlert}
                  label="Explicit Content (18+)"
                  activeClass="bg-warning/5 border-warning/25"
                  activeIconClass="text-warning"
                />
              </div>
            </aside>

            {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
            <main className="flex-1 min-w-0 p-6 sm:p-7 lg:p-8">
              <Tabs defaultValue="metadata" className="w-full">
                {/* Tab strip — glass-frosted pill (AlbumPage / ProfilePage pattern) */}
                <div
                  className={cn(
                    "glass-frosted rounded-2xl border border-border/50 shadow-raised",
                    "p-1 mb-7 inline-flex w-full sm:w-auto",
                  )}
                >
                  <TabsList className="bg-transparent h-auto p-0 gap-1 w-full sm:w-auto flex">
                    {(
                      [
                        { value: "metadata", label: "Info", icon: Type },
                        { value: "canvas", label: "Canvas", icon: Video },
                        { value: "lyrics", label: "Lyrics", icon: Languages },
                        { value: "legal", label: "Legal", icon: FileText },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className={cn(
                          "flex-1 sm:flex-none sm:px-6 gap-2 py-2.5",
                          "rounded-xl text-xs font-bold uppercase tracking-wider",
                          "transition-all duration-200",
                          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-brand",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <Icon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* ── TAB 1: Metadata ────────────────────────────────────── */}
                <TabsContent
                  value="metadata"
                  className="space-y-6 animate-fade-up animation-fill-both focus:outline-none"
                >
                  <SectionHeader
                    icon={Music}
                    title="Track Information"
                    description="Core identity fields required for distribution"
                  />

                  {/* Title */}
                  <div className="space-y-1.5">
                    <FieldLabel required icon={Music} htmlFor="track-title">
                      Song Title
                    </FieldLabel>
                    <Input
                      id="track-title"
                      {...register("title")}
                      placeholder="Enter track title…"
                      autoComplete="off"
                      className={cn(
                        "h-12 text-base font-bold bg-card/50 border-border/60",
                        "focus:border-primary/60 focus:ring-primary/20 rounded-xl px-4",
                        errors.title && "border-destructive/60",
                      )}
                      aria-invalid={!!errors.title}
                      aria-describedby={
                        errors.title ? "title-error" : undefined
                      }
                    />
                    <ErrorMessage message={errors.title?.message} />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <FieldLabel icon={AlignLeft} htmlFor="track-description">
                      Description
                    </FieldLabel>
                    <Textarea
                      id="track-description"
                      {...register("description")}
                      placeholder="Optional track description…"
                      className={cn(
                        "min-h-[80px] bg-card/50 border-border/60",
                        "focus:border-primary/60 focus:ring-primary/20 rounded-xl px-4 py-3",
                        "resize-none",
                        errors.description && "border-destructive/60",
                      )}
                      aria-invalid={!!errors.description}
                    />
                    <ErrorMessage message={errors.description?.message} />
                  </div>

                  {/* Artist + Album */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Controller
                      control={control}
                      name="artistId"
                      render={({ field, fieldState }) => (
                        <div>
                          <ArtistSelector
                            label="Nghệ sĩ chính"
                            singleSelect
                            value={mainArtistValue}
                            required
                            onChange={(ids) => field.onChange(ids[0] || "")}
                            className="bg-transparent border-input rounded-md"
                          />
                          <ErrorMessage message={fieldState.error?.message} />
                        </div>
                      )}
                    />
                    <div className="space-y-1.5">
                      <Controller
                        control={control}
                        name="featuringArtistIds"
                        render={({ field }) => (
                          <ArtistSelector
                            label="Nghệ sĩ hợp tác (Feat)"
                            singleSelect={false}
                            value={field.value || []}
                            onChange={field.onChange}
                            disabledIds={mainArtistValue}
                            className="bg-transparent border-input rounded-md"
                          />
                        )}
                      />
                    </div>
                    <Controller
                      name="albumId"
                      control={control}
                      render={({ field }) => (
                        <AlbumSelector
                          label="Parent Album"
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  {/* Genre + Release Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Controller
                      name="genreIds"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1.5">
                          <GenreSelector
                            label="Musical Genres"
                            variant="form"
                            required
                            value={field.value}
                            onChange={field.onChange}
                            className="bg-card/50 border-border/60 rounded-xl"
                          />
                          <ErrorMessage
                            message={errors.genreIds?.message as string}
                          />
                        </div>
                      )}
                    />
                    <div className="space-y-1.5">
                      <FieldLabel icon={Calendar} htmlFor="release-date">
                        Release Date
                      </FieldLabel>
                      <Input
                        id="release-date"
                        type="date"
                        {...register("releaseDate")}
                        className="h-11 bg-card/50 border-border/60 focus:border-primary/60 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FieldLabel icon={Tags}>Matching Tags</FieldLabel>
                      <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">
                        Min. 1 required
                      </span>
                    </div>
                    <Controller
                      name="tags"
                      control={control}
                      render={({ field }) => (
                        <TagInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="e.g. sad, cinematic, lofi…"
                          className="bg-card/50 border-border/60 min-h-[52px] rounded-xl"
                        />
                      )}
                    />
                    <div className="flex items-start gap-2 text-muted-foreground/55 px-1">
                      <Info
                        className="size-3 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-[10px] leading-relaxed">
                        Tags drive AI canvas matching and search optimization.
                      </p>
                    </div>
                    <ErrorMessage message={errors.tags?.message as string} />
                  </div>

                  {/* Track / Disk numbers */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <FieldLabel icon={ListOrdered} htmlFor="track-number">
                        Track No.
                      </FieldLabel>
                      <Input
                        id="track-number"
                        type="number"
                        min={1}
                        {...register("trackNumber", { valueAsNumber: true })}
                        className="bg-card/50 border-border/60 rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel icon={Disc} htmlFor="disk-number">
                        Disk No.
                      </FieldLabel>
                      <Input
                        id="disk-number"
                        type="number"
                        min={1}
                        {...register("diskNumber", { valueAsNumber: true })}
                        className="bg-card/50 border-border/60 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ── TAB 2: Visual Canvas ────────────────────────────────── */}
                <TabsContent
                  value="canvas"
                  className="space-y-6 animate-fade-up animation-fill-both focus:outline-none"
                >
                  <SectionHeader
                    icon={Video}
                    title="Visual Canvas"
                    description="Background video experience for this track"
                  />

                  {/* Smart selection info banner */}
                  <div
                    className={cn(
                      "card-base p-5 space-y-2",
                      "bg-gradient-to-r from-primary/8 via-transparent to-transparent",
                      "border-l-[3px] border-l-primary border-t-0 border-b-0 border-r-0",
                      "rounded-l-none rounded-r-2xl",
                    )}
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="size-4" aria-hidden="true" />
                      <h4 className="text-xs font-black uppercase tracking-widest">
                        Smart Selection
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Leave blank for AI to auto-select based on{" "}
                      <span className="font-bold text-primary">
                        Neural Tags
                      </span>{" "}
                      ({tagSummary}). Manual selection overrides this.
                    </p>
                  </div>

                  <Controller
                    name="moodVideoId"
                    control={control}
                    render={({ field }) => (
                      <MoodVideoPicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </TabsContent>

                {/* ── TAB 3: Lyrics ───────────────────────────────────────── */}
                <TabsContent
                  value="lyrics"
                  className="space-y-6 animate-fade-up animation-fill-both focus:outline-none"
                >
                  <SectionHeader
                    icon={Languages}
                    title="Lyrics Engine"
                    description="Configure lyric display mode and content"
                  />

                  {/* Rendering engine selector */}
                  <div
                    className={cn(
                      "card-base p-4",
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                    )}
                  >
                    <div className="space-y-0.5">
                      <FieldLabel icon={AlignLeft}>Rendering Engine</FieldLabel>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Lyric display format
                      </p>
                    </div>
                    <Controller
                      name="lyricType"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className={cn(
                              "w-full sm:w-[220px] h-11 rounded-xl font-bold",
                              "bg-card/50 border-border/60",
                              "focus:border-primary/60 focus:ring-primary/20",
                            )}
                            aria-label="Select lyric rendering engine"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            sideOffset={6}
                            className={cn(
                              "glass-heavy border-border/50 rounded-xl",
                              "z-[200]",
                            )}
                          >
                            <SelectItem value="none">
                              Disabled — No lyrics
                            </SelectItem>
                            <SelectItem value="plain">Plain Text</SelectItem>
                            <SelectItem value="synced">
                              Synced (Karaoke LRC)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Conditional lyric content */}
                  {lyricType !== "none" ? (
                    <div className="space-y-3 animate-fade-up animation-fill-both">
                      <div className="flex items-center justify-between px-0.5">
                        <FieldLabel icon={AlignLeft} htmlFor="lyrics-content">
                          Lyrics Content
                        </FieldLabel>
                        {lyricType === "synced" && (
                          <span className="badge badge-playing text-[9px] font-black uppercase tracking-widest">
                            LRC Format
                          </span>
                        )}
                      </div>
                      <Textarea
                        id="lyrics-content"
                        {...register("plainLyrics")}
                        className={cn(
                          "min-h-[340px] sm:min-h-[400px]",
                          "bg-card/50 border-border/60",
                          "font-mono text-sm leading-[1.9]",
                          "scrollbar-thin rounded-2xl p-5",
                          "focus:border-primary/60 focus:ring-primary/20",
                          "transition-colors",
                          "resize-y",
                        )}
                        placeholder={
                          lyricType === "synced"
                            ? "[00:12.30] First line of lyrics…\n[00:15.50] Next line here…"
                            : "Paste plain lyrics here…"
                        }
                        aria-label="Lyrics content"
                        spellCheck={lyricType === "plain"}
                      />
                      <p className="text-[10px] text-muted-foreground/55 text-center italic">
                        {lyricType === "synced"
                          ? "LRC format enables real-time Karaoke mode in Neural Player."
                          : "Plain mode displays static scrolling lyrics."}
                      </p>
                    </div>
                  ) : (
                    /* Empty state */
                    <div
                      className={cn(
                        "card-base border-dashed shadow-none",
                        "flex flex-col items-center justify-center min-h-[320px] gap-4 text-center",
                        "animate-fade-in",
                      )}
                      role="status"
                      aria-label="Lyrics disabled"
                    >
                      <div className="flex items-center justify-center size-14 rounded-full bg-muted text-muted-foreground/35">
                        <Languages className="size-7" aria-hidden="true" />
                      </div>
                      <div className="space-y-1.5 max-w-xs">
                        <p className="text-sm font-bold text-foreground">
                          Auto-Lyrics Disabled
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Select <strong>Plain Text</strong> or{" "}
                          <strong>Synced</strong> above to add lyrics. System
                          will search LRCLIB if left empty.
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── TAB 4: Legal ────────────────────────────────────────── */}
                <TabsContent
                  value="legal"
                  className="space-y-6 animate-fade-up animation-fill-both focus:outline-none"
                >
                  <SectionHeader
                    icon={FileText}
                    title="Legal Information"
                    description="Copyright and distribution metadata"
                  />

                  {/* Copyright */}
                  <div className="space-y-1.5">
                    <FieldLabel icon={Copyright} htmlFor="track-copyright">
                      Copyright Notice
                    </FieldLabel>
                    <Textarea
                      id="track-copyright"
                      {...register("copyright")}
                      placeholder="© 2024 Artist Name. All rights reserved."
                      className={cn(
                        "min-h-[80px] bg-card/50 border-border/60",
                        "focus:border-primary/60 focus:ring-primary/20 rounded-xl px-4 py-3",
                        "resize-none",
                        errors.copyright && "border-destructive/60",
                      )}
                      aria-invalid={!!errors.copyright}
                    />
                    <ErrorMessage message={errors.copyright?.message} />
                  </div>

                  {/* ISRC */}
                  <div className="space-y-1.5">
                    <FieldLabel icon={Hash} htmlFor="track-isrc">
                      ISRC Code
                    </FieldLabel>
                    <Input
                      id="track-isrc"
                      {...register("isrc")}
                      placeholder="USRC17607839"
                      className={cn(
                        "h-11 bg-card/50 border-border/60",
                        "focus:border-primary/60 focus:ring-primary/20 rounded-xl px-4",
                        "font-mono uppercase",
                        errors.isrc && "border-destructive/60",
                      )}
                      aria-invalid={!!errors.isrc}
                      aria-describedby={errors.isrc ? "isrc-error" : undefined}
                    />
                    <div className="flex items-start gap-2 text-muted-foreground/55 px-1">
                      <Info
                        className="size-3 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-[10px] leading-relaxed">
                        International Standard Recording Code (optional).
                      </p>
                    </div>
                    <ErrorMessage message={errors.isrc?.message} />
                  </div>
                </TabsContent>
              </Tabs>
            </main>
          </form>
        </div>

        {/* ════ FOOTER ════════════════════════════════════════════════════════ */}
        <footer
          className={cn(
            "px-6 sm:px-8 py-4 sm:py-5",
            "border-t border-border/35 glass-heavy shrink-0",
            "flex items-center justify-between gap-4",
            "rounded-b-3xl",
          )}
        >
          {/* UUID badge */}
          <div className="hidden sm:block shrink-0">
            <span className="badge badge-muted text-[9px] font-mono uppercase tracking-wider">
              {trackToEdit?._id
                ? `ID: ${trackToEdit._id.slice(-8)}`
                : "NEW_TRACK"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-ghost h-11 px-6 font-bold uppercase tracking-widest text-[11px]"
            >
              Cancel
            </button>

            <button
              form="track-form"
              type="submit"
              disabled={isLoading}
              className={cn(
                "btn-primary h-11 px-8 font-black uppercase tracking-widest text-[11px]",
                "min-w-[160px] gap-2.5",
              )}
              aria-label={isEditing ? "Save track changes" : "Upload new track"}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Processing…
                </>
              ) : (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  {isEditing ? "Save Changes" : "Publish Track"}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default memo(TrackModal);
