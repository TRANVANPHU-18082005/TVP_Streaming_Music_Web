import { useState } from "react";
import { useGenresByUserQuery } from "@/features/genre/hooks/useGenresQuery";

interface ForMeGenrePickerProps {
  onSkip: () => void;
  onConfirm: (genreIds: string[]) => void;
}

export const ForMeGenrePicker = ({ onSkip, onConfirm }: ForMeGenrePickerProps) => {
  const { data, isLoading } = useGenresByUserQuery({ page: 1, limit: 18, sort: "popular" });
  const [selected, setSelected] = useState<string[]>([]);
  const genres = data?.genres ?? [];

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-zinc-950 p-5 text-white">
        <h2 className="text-xl font-semibold">Chọn gu của bạn</h2>
        <p className="mt-1 text-sm text-white/70">Chọn 3 đến 5 thể loại. Bạn có thể bỏ qua.</p>
        {isLoading ? (
          <p className="py-8 text-sm text-white/60">Đang tải thể loại...</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.map((genre) => {
              const active = selected.includes(genre._id);
              return (
                <button
                  key={genre._id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(genre._id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active ? "border-white bg-white text-black" : "border-white/20 text-white"
                  }`}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onSkip} className="text-sm text-white/70">
            Bỏ qua
          </button>
          <button
            type="button"
            disabled={selected.length < 3}
            onClick={() => onConfirm(selected)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Nghe các thể loại này
          </button>
        </div>
      </div>
    </div>
  );
};
