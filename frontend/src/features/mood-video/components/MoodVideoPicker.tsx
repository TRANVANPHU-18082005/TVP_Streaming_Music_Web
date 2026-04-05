"use client";

import React, { useState, useMemo, useCallback, memo } from "react";
import { Search, Video, Check, Play, X, Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMoodVideosQuery } from "../hooks/useMoodVideoQuery";
import { Button } from "@/components/ui/button";

interface MoodVideoPickerProps {
  value?: string | null; // ID của video đang chọn
  onChange: (videoId: string | null) => void;
  className?: string;
}

export const MoodVideoPicker = memo(
  ({ value, onChange, className }: MoodVideoPickerProps) => {
    const [searchTerm, setSearchTerm] = useState("");

    // 1. Fetch danh sách video (Sử dụng Hook đã có của bạn)
    const { data, isLoading } = useMoodVideosQuery({
      isActive: true,
      limit: 50, // Lấy đủ nhiều để picker chọn thoải mái
    });

    const videos = data?.videos || [];

    // 2. Filter logic (Tìm kiếm nhanh tại chỗ)
    const filteredVideos = useMemo(() => {
      if (!searchTerm) return videos;
      const s = searchTerm.toLowerCase();
      return videos.filter(
        (v) =>
          v.title.toLowerCase().includes(s) ||
          v.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }, [videos, searchTerm]);

    // 3. Tìm video đang được chọn để hiển thị Preview lớn
    const selectedVideo = useMemo(
      () => videos.find((v) => v._id === value),
      [videos, value],
    );

    const handleSelect = useCallback(
      (id: string) => {
        // Nếu click vào cái đang chọn thì bỏ chọn (Toggle)
        onChange(value === id ? null : id);
      },
      [value, onChange],
    );

    return (
      <div className={cn("space-y-4", className)}>
        {/* HEADER & SEARCH */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-background/50 border-border/40 focus:ring-primary/20"
            />
          </div>

          {!value && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-wave-3 uppercase tracking-wider animate-pulse">
              <Info className="size-3.5" />
              Để trống để hệ thống tự khớp theo Tags
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: GRID LIST (8 Columns) */}
          <div className="lg:col-span-8">
            <ScrollArea className="h-[420px] rounded-2xl border border-border/40 bg-card/20 p-4 shadow-inner">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[9/16] rounded-xl skeleton"
                    />
                  ))}
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredVideos.map((video) => (
                    <div
                      key={video._id}
                      onClick={() => handleSelect(video._id)}
                      className={cn(
                        "group relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer transition-all duration-300",
                        "border-2",
                        value === video._id
                          ? "border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] scale-[0.98]"
                          : "border-transparent hover:border-white/20",
                      )}
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />

                      {/* Overlay info */}
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[10px] font-bold text-white truncate">
                          {video.title}
                        </p>
                      </div>

                      {/* Checkmark badge */}
                      {value === video._id && (
                        <div className="absolute top-2 right-2 size-6 rounded-full bg-primary flex items-center justify-center shadow-lg animate-in zoom-in-50">
                          <Check className="size-3.5 text-white stroke-[3px]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20">
                  <Video className="size-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    Không tìm thấy video nào
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* RIGHT: PREVIEW & DETAILS (4 Columns) */}
          <div className="lg:col-span-4">
            <div
              className={cn(
                "h-full rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden flex flex-col",
                !selectedVideo && "items-center justify-center border-dashed",
              )}
            >
              {selectedVideo ? (
                <>
                  <div className="relative aspect-[9/16] w-full bg-black">
                    <video
                      key={selectedVideo._id} // Re-render video when ID changes
                      src={selectedVideo.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white flex items-center gap-1.5">
                      <Play className="size-2.5 fill-white" /> Preview Mode
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase truncate">
                        {selectedVideo.title}
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedVideo.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[9px] h-5 bg-white/5 border-white/5"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange(null)}
                      className="w-full text-destructive hover:bg-destructive/10 h-8 rounded-lg text-xs"
                    >
                      <X className="size-3 mr-2" /> Bỏ chọn video này
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="size-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto shadow-inner">
                    <Flame className="size-8 text-primary/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Smart Matching
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Hệ thống sẽ tự động chọn Video Canvas phù hợp nhất dựa
                      trên các <b>Tags</b> cảm xúc của bài hát.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

MoodVideoPicker.displayName = "MoodVideoPicker";
