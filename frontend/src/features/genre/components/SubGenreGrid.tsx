import { Link } from "react-router-dom";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IGenre } from "../types";

export const SubGenreGrid = ({ genres }: { genres: IGenre[] }) => {
  if (!genres || genres.length === 0) return null;

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h3 className="text-xl font-bold mb-4">Khám phá thêm</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {genres.map((g) => (
          <Link
            key={g._id}
            to={`/genres/${g.slug}`}
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
          >
            <ImageWithFallback
              src={g.image}
              alt={g.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
              <span className="font-bold text-white truncate w-full">
                {g.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
export default SubGenreGrid;
