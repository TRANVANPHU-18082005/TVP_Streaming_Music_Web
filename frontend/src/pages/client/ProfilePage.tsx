import { useState, memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit,
  Music,
  Users,
  Calendar,
  MapPin,
  ExternalLink,
  Heart,
  History,
  Mic2,
  PieChart,
  LayoutGrid,
} from "lucide-react";

// Đảm bảo các import này đúng với cấu trúc thư mục của bạn
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";

const mockUser = {
  fullName: "Trần Văn Phú",
  username: "phutran2005",
  email: "phu@example.com",
  role: "user",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400",
  coverImage:
    "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=1200",
  bio: "Đam mê lập trình và âm nhạc lo-fi. Đang xây dựng hệ thống streaming âm nhạc của riêng mình. 🚀",
  location: "Hồ Chí Minh, Việt Nam",
  joinDate: "Tháng 8, 2023",
  website: "phutran.dev",
  themeColor: "#3b82f6",
  stats: {
    followers: 1250,
    following: 450,
    likedTracks: 856,
  },
  insights: [
    { genre: "Pop", percentage: 45 },
    { genre: "Indie", percentage: 30 },
    { genre: "Lo-fi", percentage: 15 },
    { genre: "Rock", percentage: 10 },
  ],
  topArtists: [
    {
      name: "Đen Vâu",
      image:
        "https://images.unsplash.com/photo-1494790108755-2616c5e93413?w=150",
      genre: "Rap",
    },
    {
      name: "Vũ.",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      genre: "Indie",
    },
    {
      name: "Sơn Tùng M-TP",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
      genre: "V-Pop",
    },
  ],
};

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#02040a] text-white overflow-x-hidden">
      {/* --- 1. HEADER & COVER --- */}
      <section className="relative h-64 md:h-80 w-full overflow-hidden">
        <div
          className="absolute inset-0 z-10 opacity-60"
          style={{
            background: `linear-gradient(to top, #02040a, ${mockUser.themeColor}44)`,
          }}
        />
        <ImageWithFallback
          src={mockUser.coverImage}
          alt="Cover"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="container relative z-20 h-full flex items-end px-4 md:px-6 pb-6 mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group shrink-0"
            >
              <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-[#02040a] shadow-2xl">
                <AvatarImage src={mockUser.avatar} alt={mockUser.fullName} />
                <AvatarFallback className="bg-blue-600 text-3xl font-bold">
                  P
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Edit className="size-6 text-white" />
              </div>
            </motion.div>

            <div className="flex-1 text-center md:text-left">
              <Badge className="mb-2 bg-blue-500 hover:bg-blue-600 text-white border-none">
                PRO MEMBER
              </Badge>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-1 text-white">
                {mockUser.fullName}
              </h1>
              <p className="text-white/50 font-medium">@{mockUser.username}</p>
            </div>

            <div className="flex gap-3 mb-2 shrink-0">
              <Button className="rounded-full bg-white text-black hover:bg-white/90 px-6 font-bold">
                <Edit className="mr-2 size-4" /> Chỉnh sửa
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* --- 2. MAIN CONTENT GRID --- */}
      <div className="container px-4 md:px-6 py-8 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SIDEBAR */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md text-white">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white/40 uppercase mb-2 tracking-wider">
                    Giới thiệu
                  </h3>
                  <p className="text-sm leading-relaxed text-white/90">
                    {mockUser.bio}
                  </p>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <MapPin className="size-4 text-blue-400" />{" "}
                    {mockUser.location}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <Calendar className="size-4 text-blue-400" /> Tham gia{" "}
                    {mockUser.joinDate}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <ExternalLink className="size-4 text-blue-400" />
                    <a
                      href={`https://${mockUser.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {mockUser.website}
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4">
                  <div className="text-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="text-lg font-bold">
                      {mockUser.stats.followers}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase font-bold">
                      Followers
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="text-lg font-bold">
                      {mockUser.stats.following}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase font-bold">
                      Following
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/5 border border-blue-500/30">
                    <div className="text-lg font-bold text-blue-400">
                      {mockUser.stats.likedTracks}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase font-bold">
                      Likes
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GU ÂM NHẠC */}
            <Card className="bg-white/5 border-white/10 overflow-hidden text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PieChart className="size-4 text-blue-400" /> GU ÂM NHẠC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockUser.insights.map((item) => (
                  <div key={item.genre} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{item.genre}</span>
                      <span className="text-white/40">{item.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* MAIN TABS */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs
              defaultValue="overview"
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="bg-white/5 border border-white/10 p-1 rounded-full w-full max-w-md flex">
                <TabsTrigger
                  value="overview"
                  className="flex-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all"
                >
                  <LayoutGrid className="size-4 mr-2" /> Tổng quan
                </TabsTrigger>
                <TabsTrigger
                  value="playlists"
                  className="flex-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all"
                >
                  <Music className="size-4 mr-2" /> Playlist
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="flex-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all"
                >
                  <History className="size-4 mr-2" /> Gần đây
                </TabsTrigger>
              </TabsList>

              <div className="mt-8">
                <AnimatePresence mode="wait">
                  {activeTab === "overview" && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      {/* Liked Songs Card */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="relative h-40 rounded-3xl overflow-hidden group cursor-pointer shadow-2xl"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-between px-6 md:px-8">
                          <div className="flex items-center gap-4 md:gap-6">
                            <div className="size-16 md:size-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                              <Heart className="size-8 md:size-10 text-white fill-current" />
                            </div>
                            <div>
                              <h2 className="text-xl md:text-2xl font-black">
                                Bài hát đã thích
                              </h2>
                              <p className="text-sm opacity-80">
                                {mockUser.stats.likedTracks} bài hát trong thư
                                viện
                              </p>
                            </div>
                          </div>
                          <Button className="rounded-full bg-white/20 hover:bg-white/40 text-white border-white/20 hidden md:flex">
                            Nghe ngay
                          </Button>
                        </div>
                      </motion.div>

                      {/* Top Artists */}
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Mic2 className="size-5 text-blue-400" /> Nghệ sĩ nghe
                          nhiều nhất
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {mockUser.topArtists.map((artist, idx) => (
                            <motion.div
                              key={artist.name}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.1 }}
                              className="flex flex-col items-center p-4 rounded-3xl bg-white/5 hover:bg-white/10 transition-all text-center group border border-white/5"
                            >
                              <Avatar className="size-20 mb-3 border-2 border-transparent group-hover:border-blue-500 transition-all shadow-xl">
                                <AvatarImage
                                  src={artist.image}
                                  alt={artist.name}
                                />
                                <AvatarFallback>
                                  {artist.name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <p className="font-bold text-sm truncate w-full">
                                {artist.name}
                              </p>
                              <p className="text-[10px] text-white/40 uppercase font-bold">
                                {artist.genre}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "playlists" && (
                    <motion.div
                      key="playlists"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center h-40 bg-white/5 rounded-3xl border border-dashed border-white/10 text-white/40"
                    >
                      Chưa có playlist công khai nào.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
