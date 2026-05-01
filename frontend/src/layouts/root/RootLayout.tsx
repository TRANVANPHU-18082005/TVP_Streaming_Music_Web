// src/layouts/RootLayout.tsx
import { Outlet, useNavigate } from "react-router-dom";
import { useInitAuth } from "@/features/auth";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { MusicPlayer } from "@/features/player/components/MusicPlayer";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { ContextSheetProvider } from "@/app/provider/SheetProvider";
import { appendQueueIds, IAlbum, IArtist, IGenre, IPlaylist } from "@/features";
import { toast } from "sonner";

const RootLayout = () => {
  // 1. Kích hoạt kiểm tra phiên đăng nhập ngay khi Layout mount
  useInitAuth();

  // 2. Lấy trạng thái kiểm tra từ Store
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // 2. Lấy trạng thái kiểm tra từ Store
  const { isAuthChecking } = useAppSelector((state) => state.auth);

  // 3. Splash Screen: Chặn render Outlet cho đến khi xác định được danh tính (User hoặc Guest)
  if (isAuthChecking) {
    return (
      <WaveformLoader
        glass={false}
        fullscreen
        text="Đang kết nối hệ thống..."
      />
    );
  }

  return (
    <ContextSheetProvider
      // Album
      onAlbumAddToQueue={(album) => {
        dispatch(appendQueueIds((album as IAlbum).trackIds ?? []));
        toast.success(`Đã thêm album ${(album as IAlbum).title} vào hàng đợi`);
      }}
      onAlbumGoToArtist={(slug) => navigate(`/artists/${slug}`)}
      onAlbumShare={(album) =>
        navigator.share?.({
          title: (album as IAlbum).title,
          url: `/albums/${(album as IAlbum)._id}`,
        })
      }
      // Playlist
      onPlaylistShare={(playlist) =>
        navigator.share?.({
          title: (playlist as IPlaylist).title,
          url: `/playlists/${(playlist as IPlaylist)._id}`,
        })
      }
      // Artist
      onArtistViewProfile={(artist) =>
        navigate(`/artists/${(artist as IArtist)._id}`)
      }
      onArtistShare={(artist) =>
        navigator.share?.({
          title: (artist as IArtist).name,
          url: `/artists/${(artist as IArtist)._id}`,
        })
      }
      onArtistAddToQueue={(artist) => {
        dispatch(appendQueueIds((artist as IArtist).trackIds ?? []));
        toast.success(
          `Đã thêm nghệ sĩ ${(artist as IArtist).name} vào hàng đợi`,
        );
      }}
      // Genre
      onGenreShare={(genre) =>
        navigator.share?.({
          title: (genre as IGenre).name,
          url: `/genres/${(genre as IGenre)._id}`,
        })
      }
      // Add to Playlist callbacks (optional — AddToPlaylistSheet handles mutations internally)
      onAlbumAddToPlaylistSelect={() => {}}
      onArtistAddToPlaylistSelect={() => {}}
      onGenreAddToPlaylistSelect={() => {}}
    >
      <div className="relative min-h-screen">
        <main className="">
          {/* Thêm padding bottom để không bị Player đè mất nội dung cuối trang */}
          <Outlet />
        </main>

        {/* 4. MusicPlayer: Luôn hiện diện xuyên suốt các trang */}
        <MusicPlayer />
      </div>
    </ContextSheetProvider>
  );
};

export default RootLayout;
