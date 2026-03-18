import { TrendingUp, Music4 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Genre } from "@/features/genre/types";

// Nếu dự án bạn có ImageWithFallback, hãy dùng nó. Nếu không, đổi thành <img> thường.
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface GenreCardProps {
  genre: Genre;
  className?: string;
  size?: "md" | "lg";
}

export function GenreCard({ genre, className, size = "md" }: GenreCardProps) {
  // Ưu tiên Gradient -> Color -> Màu mặc định
  const bgStyle = genre.gradient
    ? { background: genre.gradient }
    : genre.color
      ? { backgroundColor: genre.color }
      : { backgroundColor: "hsl(var(--muted))" };

  return (
    <Link
      to={`/genres/${genre.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[18px] sm:rounded-2xl",
        "transition-all duration-500 ease-out",
        "hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Tỷ lệ khung hình an toàn
        size === "lg" ? "aspect-[16/9]" : "aspect-[4/3] sm:aspect-square",
        className,
      )}
      style={bgStyle}
    >
      {/* ================= 1. HÌNH NỀN (BACKGROUND) ================= */}
      {genre.image ? (
        <ImageWithFallback
          src={genre.image}
          alt={genre.name}
          className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-[800ms] ease-[cubic-bezier(0.21,1.11,0.81,0.99)] group-hover:scale-110 group-hover:opacity-80 will-change-transform"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 transition-transform duration-[800ms] group-hover:scale-110">
          <Music4 className="size-20" />
        </div>
      )}

      {/* ================= 2. LỚP PHỦ TẠO CHIỀU SÂU ================= */}
      {/* Gradient dưới đáy: Đậm và dài hơn một chút để chứa Tiêu đề dài */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15 pointer-events-none" />

      {/* ================= 3. NỘI DUNG (CONTENT) ================= */}
      <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
        {/* TOP AREA: Dành riêng cho Badge (Không bao giờ đụng vào Text) */}
        <div className="flex items-start justify-end h-6 sm:h-8">
          {genre.isTrending && (
            <span className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 px-2 py-1 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shrink-0">
              <TrendingUp className="size-3 sm:size-3.5 text-rose-400" />
              Hot
            </span>
          )}
        </div>

        {/* BOTTOM AREA: Dành cho Text Information */}
        <div className="flex flex-col justify-end w-full">
          {/* Tiêu đề: Ép chặt 2 dòng, break-words để tự xuống dòng nếu có từ siêu dài */}
          <h3
            className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-white drop-shadow-xl line-clamp-2 break-words leading-[1.15]"
            title={genre.name} // Hiện tooltip nếu vẫn bị cắt
          >
            {genre.name}
          </h3>

          {/* HIỆU ỨNG SHOW/HIDE RESPONSIVE */}
          <div
            className="grid transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
              grid-rows-[1fr] opacity-100 mt-1
              lg:grid-rows-[0fr] lg:opacity-0 lg:mt-0
              lg:group-hover:grid-rows-[1fr] lg:group-hover:opacity-100 lg:group-hover:mt-1
            "
          >
            {/* Box chứa nội dung cần ẩn hiện */}
            <div className="overflow-hidden flex flex-col gap-0.5 sm:gap-1 w-full">
              {/* Mô tả: Chỉ để 1 dòng */}
              {genre.description && (
                <p className="text-[10px] sm:text-[11px] text-white/70 line-clamp-1 font-medium truncate w-full pr-2">
                  {genre.description}
                </p>
              )}

              {/* Thông số Tracks */}
              <div className="flex items-center text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-white/50 mt-0.5">
                <span>{genre.trackCount || 0} Tracks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
export default GenreCard;
