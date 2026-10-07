import { useEffect, useMemo, useRef, useState, memo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion, motion } from "framer-motion";
import { Mic2, Radio, Sparkles, Users, Play, TrendingUp, Activity, ChevronRight } from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { CLIENT_PATHS } from "@/config/paths";
import trackApi from "@/features/track/api/trackApi";
import { usePublicRecordings } from "@/features/karaoke/hooks/useKaraokeQueries";
import type { IKaraokeRecording } from "@/features/karaoke/types";
import { usePublicRoomsQuery } from "@/features/music-room/hooks/useRoomsQuery";
import { ROOM_THEMES, type MusicRoom } from "@/features/music-room/types/room.types";
import { usePublishedShorts } from "@/features/shorts/hooks/useShorts";
import type { ITrackShort } from "@/features/shorts/types";
import { cn } from "@/lib/utils";
import { HOME_CHART_QUERY_KEY } from "./useHomeChart";

import SectionAmbient from "@/components/SectionAmbient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MusicResult from "@/components/ui/Result";
import { QueryErrorResult } from "@/components/ui/QueryState";

const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const cardVariants = {
  hidden: { opacity: 0, x: 18 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.38, ease: EASE_EXPO },
  }),
};

const SignatureHeader = memo(() => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--brand) / 0.14)",
            color: "hsl(var(--brand))",
          }}
        >
          <Sparkles className="size-3.5" />
        </div>
        <span className="text-overline" style={{ color: "hsl(var(--brand))" }}>
          Đặc sắc
        </span>
      </div>
      <h2 className="text-section-title text-foreground leading-tight">
        Đang có trên TVP
      </h2>
      <p className="text-section-subtitle hidden sm:block">
        Khám phá các phòng nhạc, video ngắn và bảng xếp hạng.
      </p>
    </div>
  </div>
));
SignatureHeader.displayName = "SignatureHeader";

const CARD_BASE =
  "group relative flex h-72 shrink-0 snap-start flex-col overflow-hidden rounded-[2rem] border border-border/40 bg-background/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-border/80 dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type StripCard =
  | { kind: "room"; room: MusicRoom }
  | { kind: "karaoke"; recording: IKaraokeRecording }
  | { kind: "short"; short: ITrackShort }
  | { kind: "chart"; tracks: { _id: string; title: string; rank: number }[] }
  | { kind: "forMe" };

function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
}

function StripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="skeleton h-72 w-64 shrink-0 rounded-[2rem]" />
      ))}
    </div>
  );
}

function RoomPreview({ room, reduced }: { room: MusicRoom; reduced: boolean }) {
  const theme = ROOM_THEMES[room.theme] ?? ROOM_THEMES.bar;

  return (
    <Link
      to={`/${CLIENT_PATHS.ROOMS}/${room.roomCode}`}
      className={cn(CARD_BASE, "w-64")}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 transition-opacity duration-500 group-hover:opacity-40", theme.gradient)} />

      {/* Decorative background element */}
      <div className="absolute -right-12 -top-12 size-40 rounded-full bg-brand/20 blur-3xl transition-all duration-500 group-hover:bg-brand/30 group-hover:blur-2xl" />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="mb-3 inline-flex items-center rounded-full border border-border/50 bg-background/50 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground backdrop-blur-sm">
              {theme.label}
            </span>
            <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground">{room.name}</h3>
          </div>
          <span className="relative flex h-5 shrink-0 items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2 text-[10px] font-bold tracking-wider text-red-500">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500"></span>
            </span>
            LIVE
          </span>
        </div>

        <div className="mt-auto">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/30 bg-background/40 p-3 transition-colors backdrop-blur-md group-hover:bg-background/60">
            {room.currentTrack?.coverImage ? (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-sm">
                <ImageWithFallback
                  src={room.currentTrack.coverImage}
                  alt=""
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className={cn("eq-bars eq-bars--thin", reduced && "paused")} aria-hidden="true">
                    {[1, 2, 3, 4].map((bar) => (
                      <div key={bar} className="eq-bar bg-white" style={{ height: `${24 + bar * 14}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                <Radio className="size-5" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 truncate text-xs text-muted-foreground">Đang phát</p>
              <p className="truncate text-sm font-medium text-foreground">
                {room.currentTrack?.title ?? "Chưa có bài hát"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {room.memberCount} thành viên
            </div>
            <span className="text-brand opacity-0 transition-all duration-300 translate-x-2 group-hover:translate-x-0 group-hover:opacity-100">
              Tham gia &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CardRenderer({ card, reduced }: { card: StripCard; reduced: boolean }) {
  if (card.kind === "room") {
    return <RoomPreview room={card.room} reduced={reduced} />;
  }
  if (card.kind === "karaoke") {
    const cover = card.recording.coverImage || card.recording.youtubeThumbnail;
    return (
      <Link
        to={`/${CLIENT_PATHS.KARAOKE_STUDIO}`}
        className={cn(CARD_BASE, "w-64")}
      >
        {cover ? (
          <div className="absolute inset-0 overflow-hidden">
            <ImageWithFallback src={cover} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 p-2 text-white transition-transform duration-300 backdrop-blur-md group-hover:scale-110 group-hover:bg-brand">
          <Mic2 className="size-4" />
        </div>

        <div className="relative mt-auto flex flex-col gap-2 p-5 text-white">
          <span className="inline-flex w-fit items-center rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm">
            Karaoke
          </span>
          <h3 className="line-clamp-2 text-lg font-bold leading-tight drop-shadow-md">{card.recording.title}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <span className="relative flex h-8 items-center justify-center rounded-full bg-brand px-4 transition-all duration-300 group-hover:bg-brand/80 group-hover:pr-3">
              Hát ngay
              <Activity className="ml-2 size-4 opacity-0 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
          </div>
        </div>
      </Link>
    );
  }
  if (card.kind === "short") {
    const poster = card.short.moodVideo?.thumbnailUrl || card.short.track?.coverImage;
    const title = card.short.title || card.short.track?.title || "Short";
    return (
      <Link
        to={`/${CLIENT_PATHS.SHORTS}/${card.short._id}`}
        className={cn(CARD_BASE, "w-44")}
      >
        {poster ? (
          <div className="absolute inset-0 overflow-hidden">
            <ImageWithFallback src={poster} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md">
            <Play className="ml-1 size-5 fill-white" />
          </div>
        </div>

        <div className="relative mt-auto p-4 text-white">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-white/70">Shorts</span>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug drop-shadow-md">{title}</h3>
        </div>
      </Link>
    );
  }
  if (card.kind === "chart") {
    return (
      <Link
        to={`/${CLIENT_PATHS.CHART_TOP}`}
        className={cn(CARD_BASE, "w-72")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-background to-background opacity-50" />
        <div className="absolute -right-16 -top-16 size-48 rounded-full bg-brand/10 blur-3xl transition-all duration-500 group-hover:bg-brand/20" />

        <div className="relative flex h-full flex-col p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <TrendingUp className="size-4" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-foreground">BXH Hiện tại</p>
          </div>

          <div className="flex-1 space-y-3">
            {card.tracks.map((track, i) => (
              <div key={track._id} className="group/item flex items-center gap-3">
                <span className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                  i === 0 ? "bg-amber-500/10 text-amber-500 dark:text-amber-400" :
                    i === 1 ? "bg-slate-400/10 text-slate-500 dark:text-slate-300" :
                      i === 2 ? "bg-orange-700/10 text-orange-600 dark:text-orange-400" :
                        "text-muted-foreground"
                )}>
                  {track.rank}
                </span>
                <span className="truncate text-sm font-medium text-foreground transition-colors group-hover/item:text-brand">
                  {track.title}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
            <span className="text-xs font-medium text-muted-foreground">Cập nhật liên tục</span>
            <span className="text-xs font-semibold text-brand transition-transform group-hover:translate-x-1">
              Xem Top 100 &rarr;
            </span>
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link
      to={`/${CLIENT_PATHS.FOR_ME}`}
      className={cn(CARD_BASE, "w-64")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-brand/5 to-blue-500/10 opacity-50 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="absolute right-0 top-0 size-32 -translate-y-8 translate-x-8 rounded-full bg-brand/20 blur-3xl transition-transform duration-700 group-hover:scale-150" />

      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-purple-500/20 text-brand shadow-inner ring-1 ring-white/10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>

        <div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground">Dành cho tôi</h3>
          <p className="text-sm font-medium leading-relaxed text-muted-foreground/80">
            Phiên nghe riêng được thiết kế riêng biệt dựa trên sở thích của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-brand transition-colors group-hover:text-brand/80">
            Khám phá ngay
          </span>
          <Activity className="size-4 text-brand opacity-0 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

function buildCards(
  rooms: MusicRoom[],
  recording: IKaraokeRecording | undefined,
  short: ITrackShort | undefined,
  chartTracks: { _id: string; title: string; rank: number }[],
): StripCard[] {
  const cards: StripCard[] = [];
  if (rooms[0]) cards.push({ kind: "room", room: rooms[0] });
  if (recording) cards.push({ kind: "karaoke", recording });
  if (short) cards.push({ kind: "short", short });
  if (chartTracks.length > 0) cards.push({ kind: "chart", tracks: chartTracks });

  for (const room of rooms.slice(1)) {
    if (cards.length >= 4) break;
    cards.push({ kind: "room", room });
  }

  if (cards.length > 0 && cards.length < 5) {
    cards.push({ kind: "forMe" });
  }

  return cards.slice(0, 5);
}

function StripContent() {
  const reduced = useReducedMotion() ?? false;
  const roomsQuery = usePublicRoomsQuery(1, 3);
  const karaokeQuery = usePublicRecordings({ sort: "popular", limit: 1 });
  const shortsQuery = usePublishedShorts("", 1);
  const chartQuery = useQuery({
    queryKey: HOME_CHART_QUERY_KEY,
    queryFn: trackApi.getRealtimeChart,
    staleTime: 60 * 1000,
  });

  const rooms = roomsQuery.data?.rooms ?? [];
  const recording = karaokeQuery.data?.data?.data?.[0];
  const short = shortsQuery.data?.data?.data?.[0];
  const chartTracks = useMemo(
    () =>
      (chartQuery.data?.data?.items ?? []).slice(0, 3).map((track, index) => ({
        _id: track._id,
        title: track.title,
        rank: index + 1,
      })),
    [chartQuery.data],
  );

  const isLoading =
    roomsQuery.isLoading ||
    karaokeQuery.isLoading ||
    shortsQuery.isLoading ||
    chartQuery.isLoading;

  const isError =
    roomsQuery.isError ||
    karaokeQuery.isError ||
    shortsQuery.isError ||
    chartQuery.isError;

  const isOffline = !useOnlineStatus();

  const cards = useMemo(
    () => buildCards(rooms, recording, short, chartTracks),
    [rooms, recording, short, chartTracks],
  );

  const hasResults = cards.length > 0;

  if (isLoading && !hasResults) {
    return (
      <>
        <div
          className="lg:block h-px"
          style={{
            background: `linear-gradient(
                to right,
                transparent,
                hsl(var(--brand) / 0.3) 30%,
                hsl(var(--brand) / 0.28) 70%,
                transparent
              )`,
            boxShadow: "0 0 8px hsl(var(--brand) / 0.1)",
          }}
        />
        <section className="section-block section-block--base relative overflow-hidden" aria-busy="true">
          <SectionAmbient style="brand" />
          <div className="section-container">
            <SignatureHeader />
            <StripSkeleton />
          </div>
        </section>
      </>
    );
  }

  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error-network" onRetry={() => {
          roomsQuery.refetch();
          karaokeQuery.refetch();
          shortsQuery.refetch();
          chartQuery.refetch();
        }} />
      </div>
    );
  }

  if (isError || !hasResults) {
    if (!isError && !hasResults) return null;
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <QueryErrorResult
          error={roomsQuery.error ?? karaokeQuery.error ?? shortsQuery.error ?? chartQuery.error}
          onRetry={() => {
          roomsQuery.refetch();
          karaokeQuery.refetch();
          shortsQuery.refetch();
          chartQuery.refetch();
        }} />
      </div>
    );
  }

  return (
    <>
      <div
        className="lg:block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--brand) / 0.3) 30%,
              hsl(var(--brand) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--brand) / 0.1)",
        }}
      />
      <section className="section-block section-block--base relative overflow-hidden" aria-labelledby="home-signature-heading">
        <SectionAmbient style="brand" />
        <div className="section-container">
          <SignatureHeader />

          <div className="scroll-overflow-mask -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory">
              {cards.map((card, i) => (
                <motion.div
                  key={card.kind === "room" ? card.room._id : card.kind === "karaoke" ? card.recording._id : card.kind === "short" ? card.short._id : card.kind}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-48px" }}
                  className="shrink-0 snap-start"
                >
                  <CardRenderer card={card} reduced={reduced} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function HomeSignatureStrip() {
  const { ref, near } = useNearViewport();

  if (!near) {
    return (
      <div ref={ref} className="section-container" aria-hidden="true">
        <StripSkeleton />
      </div>
    );
  }

  return <StripContent />;
}

export default HomeSignatureStrip;
