"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit,
  Heart,
  Plus,
  Play,
  MoreHorizontal,
  Loader2,
  Calendar,
  Trash2,
  Camera,
  Music2,
  History,
  Clock,
  BarChart3,
  ListMusic,
  Disc,
  ChevronRight,
} from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from "recharts";

// UI Components
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";
import { formatDate } from "@/utils/track-helper";

// Feature Hooks & Components
import { useProfileDashboard } from "@/features/profile/hooks/useProfileQuery";
import { useProfileMutations } from "@/features/profile/hooks/useProfileMutations";
import UserPlaylistModal from "@/features/playlist/components/UserPlaylistModal";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

  const { user } = useAppSelector((s) => s.auth);
  const { data: dashboard, isLoading } = useProfileDashboard();
  const { updateProfile, isUpdating } = useProfileMutations();

  const userInitials = useMemo(
    () =>
      user?.fullName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U",
    [user?.fullName],
  );

  if (isLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 selection:bg-blue-500/30">
      {/* ─── HERO SECTION ─── */}
      <section className="relative h-[50vh] w-full flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-10" />
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            src={user?.avatar || "/default-cover.jpg"}
            className="w-full h-full object-cover opacity-20 blur-3xl"
          />
        </div>

        <div className="container relative z-20 px-6 pb-12 mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
            <div className="relative group shrink-0">
              <Avatar className="size-44 md:size-56 border-[10px] border-[#050505] shadow-2xl ring-1 ring-white/10">
                <AvatarImage src={user?.avatar} alt={user?.fullName} />
                <AvatarFallback className="text-6xl font-black bg-gradient-to-br from-blue-600 to-indigo-900">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm"
              >
                <Camera className="size-8" />
              </button>
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
              <Badge className="bg-blue-600 text-white border-none px-4 py-1 font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                {user?.role} ACCOUNT
              </Badge>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
                {user?.fullName}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-[10px] text-white/40 font-black uppercase tracking-[0.3em]">
                <span className="flex items-center gap-2">
                  <Music2 className="size-4 text-blue-500" />{" "}
                  {dashboard?.library.tracks.length} Tracks
                </span>
                <span className="flex items-center gap-2">
                  <History className="size-4 text-emerald-500" />{" "}
                  {dashboard?.recentlyPlayed.length} Recent
                </span>
              </div>
            </div>

            <div className="mb-2">
              <Button
                onClick={() => setIsEditModalOpen(true)}
                className="rounded-full bg-white text-black hover:bg-blue-500 hover:text-white font-black px-8 h-12 transition-all shadow-xl"
              >
                <Edit className="mr-2 size-4" /> Edit Profile
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT TABS ─── */}
      <div className="container px-6 mx-auto mt-4">
        <Tabs
          defaultValue="overview"
          className="w-full"
          onValueChange={setActiveTab}
        >
          <div className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-2xl py-6 border-b border-white/5">
            <TabsList className="bg-transparent w-full justify-start rounded-none h-auto p-0 gap-12">
              <TabsTrigger value="overview" className="tab-premium">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="playlists" className="tab-premium">
                Playlists
              </TabsTrigger>
              <TabsTrigger value="library" className="tab-premium">
                Collection
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-12">
            <AnimatePresence mode="wait">
              {/* 1. OVERVIEW TAB */}
              {activeTab === "overview" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-16"
                >
                  <div className="lg:col-span-2 space-y-12">
                    {/* Listen Stats Chart */}
                    <div className="space-y-6">
                      <h3 className="text-xl font-black italic flex items-center gap-3 uppercase tracking-tighter">
                        <BarChart3 className="size-5 text-blue-500" /> Weekly
                        Activity
                      </h3>
                      <div className="h-64 w-full bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 shadow-inner">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboard?.analytics}>
                            <XAxis
                              dataKey="label"
                              axisLine={false}
                              tickLine={false}
                              tick={{
                                fill: "#444",
                                fontSize: 10,
                                fontWeight: 900,
                              }}
                              dy={10}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#000",
                                border: "none",
                                borderRadius: "12px",
                                fontSize: "10px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="count"
                              stroke="#3b82f6"
                              strokeWidth={4}
                              fill="url(#chartGradient)"
                            />
                            <defs>
                              <linearGradient
                                id="chartGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Recently Played List */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black italic flex items-center gap-3 uppercase tracking-tighter">
                          <History className="size-5 text-emerald-500" />{" "}
                          Recently Played
                        </h3>
                        <Button
                          variant="ghost"
                          className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
                        >
                          View All
                        </Button>
                      </div>
                      <div className="grid gap-2">
                        {dashboard?.recentlyPlayed.map((item, i) => (
                          <TrackRow
                            key={`${item._id}-${i}`}
                            track={item}
                            index={i + 1}
                            showTime
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Info */}
                  <aside className="space-y-8">
                    <div className="p-8 rounded-[2.5rem] bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 space-y-6">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">
                        User Biography
                      </p>
                      <p className="text-sm text-white/60 leading-relaxed font-medium italic">
                        "{user?.bio || "No biography provided yet."}"
                      </p>
                      <div className="pt-6 border-t border-white/5 flex items-center gap-3 text-[10px] font-black text-white/20 uppercase tracking-widest">
                        <Calendar className="size-4" /> Joined{" "}
                        {formatDate(user?.createdAt || "")}
                      </div>
                    </div>
                  </aside>
                </motion.div>
              )}

              {/* 2. PLAYLISTS TAB */}
              {activeTab === "playlists" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-12"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase">
                      My Created Playlists
                    </h2>
                    <Button
                      onClick={() => setIsCreatePlaylistOpen(true)}
                      className="rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-500 font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105"
                    >
                      <Plus className="mr-2 size-5" /> New Playlist
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {dashboard?.playlists.length === 0 ? (
                      <div className="col-span-full py-20 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem]">
                        <ListMusic className="size-12 text-white/5 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                          No playlists found
                        </p>
                      </div>
                    ) : (
                      dashboard?.playlists.map((p) => (
                        <PlaylistCard key={p._id} playlist={p} />
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* 3. LIBRARY TAB */}
              {activeTab === "library" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-12"
                >
                  <Tabs defaultValue="liked_tracks">
                    <TabsList className="bg-white/5 p-1 rounded-full mb-10 h-12">
                      <TabsTrigger
                        value="liked_tracks"
                        className="rounded-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-blue-600"
                      >
                        Liked Tracks
                      </TabsTrigger>
                      <TabsTrigger
                        value="liked_albums"
                        className="rounded-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-blue-600"
                      >
                        Albums
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="liked_tracks"
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-0"
                    >
                      {dashboard?.library.tracks.map((track) => (
                        <div
                          key={track._id}
                          className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all"
                        >
                          <img
                            src={track.coverImage}
                            className="size-14 rounded-xl object-cover shadow-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-black truncate text-base">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                              {track.artist?.name}
                            </p>
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full text-rose-500"
                          >
                            <Heart className="fill-rose-500 size-4" />
                          </Button>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent
                      value="liked_albums"
                      className="text-center py-20"
                    >
                      <Disc className="size-12 text-white/5 mx-auto mb-4" />
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                        You haven't liked any albums yet
                      </p>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </div>

      {/* <UserPlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
      /> */}

      {/* ─── STYLES ─── */}
      <style jsx global>{`
        .tab-premium {
          @apply relative pb-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 transition-all data-[state=active]:text-blue-500;
        }
        .tab-premium[data-state="active"]::after {
          content: "";
          @apply absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)];
        }
      `}</style>
    </div>
  );
}

function TrackRow({
  track,
  index,
  showTime,
}: {
  track: any;
  index: number;
  showTime?: boolean;
}) {
  return (
    <div className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent hover:border-white/5">
      <span className="w-6 text-center text-[10px] font-black text-white/10 group-hover:text-blue-500">
        {index}
      </span>
      <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-xl">
        <img
          src={track.coverImage}
          className="size-full object-cover group-hover:scale-110 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="size-4 fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black truncate text-sm group-hover:text-blue-400 transition-colors">
          {track.title}
        </p>
        <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">
          {track.artist?.name}
        </p>
      </div>
      {showTime && track.listenedAt && (
        <div className="text-[9px] font-black text-white/10 uppercase tracking-widest hidden sm:block">
          {new Date(track.listenedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="text-[10px] font-black text-white/10 uppercase tabular-nums">
          {Math.floor(track.duration / 60)}:
          {(track.duration % 60).toString().padStart(2, "0")}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: any) {
  return (
    <div className="relative group space-y-4 cursor-pointer">
      <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl relative ring-1 ring-white/5">
        <img
          src={playlist.coverImage || "/default-playlist.jpg"}
          className="size-full object-cover group-hover:scale-110 transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-all" />
        <div className="absolute bottom-4 right-4 size-10 rounded-xl bg-blue-600 flex items-center justify-center translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all shadow-lg">
          <Play className="size-4 fill-white" />
        </div>
      </div>
      <div className="px-1">
        <p className="font-black text-sm truncate uppercase tracking-tighter group-hover:text-blue-400 transition-colors">
          {playlist.title}
        </p>
        <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">
          Playlist • {playlist.tracks?.length || 0} Tracks
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6">
      <Loader2 className="size-12 text-blue-600 animate-spin" />
      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] animate-pulse">
        Synchronizing Neural Profile
      </p>
    </div>
  );
}
