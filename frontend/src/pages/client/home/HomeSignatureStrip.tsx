import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Mic2, Radio, Sparkles, Users } from "lucide-react";

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

const CARD = "glass-frosted shadow-elevated relative flex h-64 shrink-0 snap-start flex-col overflow-hidden rounded-2xl";

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
        <div key={index} className="skeleton h-64 w-52 shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

function RoomPreview({ room, reduced }: { room: MusicRoom; reduced: boolean }) {
  const theme = ROOM_THEMES[room.theme] ?? ROOM_THEMES.bar;

  return (
    <Link
      to={`/${CLIENT_PATHS.ROOMS}/${room.roomCode}`}
      className={cn(CARD, "w-52")}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.14] dark:opacity-25", theme.gradient)} />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-overline text-muted-foreground">{theme.label}</p>
            <h3 className="truncate text-sm font-semibold text-foreground">{room.name}</h3>
          </div>
          <span className="badge badge-live shrink-0 text-[10px]">LIVE</span>
        </div>
        <div className="flex items-center gap-2.5">
          {room.currentTrack?.coverImage ? (
            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
              <ImageWithFallback
                src={room.currentTrack.coverImage}
                alt=""
                className="size-full object-cover"
              />
              <div className="absolute inset-0 flex items-end justify-center bg-black/30 pb-1">
                <div className={cn("eq-bars eq-bars--thin", reduced && "paused")} aria-hidden="true">
                  {[1, 2, 3, 4].map((bar) => (
                    <div key={bar} className="eq-bar bg-primary" style={{ height: `${24 + bar * 14}%` }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Radio className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <p className="line-clamp-2 text-xs text-foreground">
            {room.currentTrack?.title ?? "Chưa phát bài nào"}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3" aria-hidden="true" />
          {room.memberCount} người
        </p>
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

  const cards = useMemo(
    () => buildCards(rooms, recording, short, chartTracks),
    [rooms, recording, short, chartTracks],
  );

  if (isLoading && cards.length === 0) {
    return (
      <section className="section-container" aria-busy="true" aria-labelledby="home-signature-heading">
        <h2 id="home-signature-heading" className="text-section-title mb-5 text-foreground">
          Đang có trên TVP
        </h2>
        <StripSkeleton />
      </section>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section className="section-container" aria-labelledby="home-signature-heading">
      <h2 id="home-signature-heading" className="text-section-title mb-5 text-foreground">
        Đang có trên TVP
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar">
        {cards.map((card) => {
          if (card.kind === "room") {
            return <RoomPreview key={card.room._id} room={card.room} reduced={reduced} />;
          }
          if (card.kind === "karaoke") {
            const cover = card.recording.coverImage || card.recording.youtubeThumbnail;
            return (
              <Link
                key={card.recording._id}
                to={`/${CLIENT_PATHS.KARAOKE_STUDIO}`}
                className={cn(CARD, "w-52")}
              >
                {cover ? (
                  <ImageWithFallback src={cover} alt="" className="absolute inset-0 size-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                <div className="relative mt-auto flex flex-col gap-2 p-4 text-white">
                  <p className="text-overline">Karaoke</p>
                  <h3 className="line-clamp-2 text-sm font-semibold">{card.recording.title}</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Mic2 className="size-3.5" aria-hidden="true" />
                    Hát ngay
                  </span>
                </div>
              </Link>
            );
          }
          if (card.kind === "short") {
            const poster = card.short.moodVideo?.thumbnailUrl || card.short.track?.coverImage;
            const title = card.short.title || card.short.track?.title || "Short";
            return (
              <Link
                key={card.short._id}
                to={`/${CLIENT_PATHS.SHORTS}/${card.short._id}`}
                className={cn(CARD, "w-36")}
              >
                {poster ? (
                  <ImageWithFallback src={poster} alt="" className="absolute inset-0 size-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="relative mt-auto p-3 text-white">
                  <p className="text-overline">Shorts</p>
                  <h3 className="line-clamp-2 text-sm font-semibold">{title}</h3>
                </div>
              </Link>
            );
          }
          if (card.kind === "chart") {
            return (
              <Link
                key="chart"
                to={`/${CLIENT_PATHS.CHART_TOP}`}
                className={cn(CARD, "w-60")}
              >
                <div className="flex h-full flex-col justify-between p-4">
                  <p className="text-overline text-brand">Bảng xếp hạng</p>
                  <ol className="flex flex-col gap-2">
                    {card.tracks.map((track) => (
                      <li key={track._id} className="flex items-baseline gap-2">
                        <span className="w-4 shrink-0 text-sm font-semibold text-brand">{track.rank}</span>
                        <span className="truncate text-sm text-foreground">{track.title}</span>
                      </li>
                    ))}
                  </ol>
                  <span className="text-xs font-medium text-muted-foreground">Xem Top 100</span>
                </div>
              </Link>
            );
          }
          return (
            <Link
              key="for-me"
              to={`/${CLIENT_PATHS.FOR_ME}`}
              className={cn(CARD, "w-52")}
            >
              <div className="flex h-full flex-col justify-between p-4">
                <Sparkles className="size-5 text-brand" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dành cho tôi</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Một phiên nghe riêng, quen và mới vừa đủ.
                  </p>
                </div>
                <span className="text-xs font-semibold text-brand">Mở phiên nghe</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
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
