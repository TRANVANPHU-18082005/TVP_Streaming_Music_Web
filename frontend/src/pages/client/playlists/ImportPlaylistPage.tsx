import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileUp, ListMusic, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SectionAmbient from "@/components/SectionAmbient";
import { CLIENT_PATHS } from "@/config/paths";
import { useImportPlaylist } from "@/features/playlist";
import type { PlaylistImportResult } from "@/features/playlist";

const MAX_LINES = 200;
const MAX_BYTES = 50_000;

type Visibility = "private" | "public" | "unlisted";

type ImportView = {
  playlist: PlaylistImportResult["playlist"] | null;
  matched: PlaylistImportResult["matched"];
  missed: { line: string }[];
};

const readLines = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);

const ImportPlaylistPage = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const importPlaylist = useImportPlaylist();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportView | null>(null);

  const lines = useMemo(() => readLines(text), [text]);
  const tooMany = lines.length > MAX_LINES;
  const pending = importPlaylist.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Tệp vượt quá 50KB.");
      return;
    }
    const content = await file.text();
    setText(content);
    setResult(null);
    setTitle((current) => {
      if (current.trim()) return current;
      const fromName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      return fromName.slice(0, 100);
    });
  };

  const submit = () => {
    if (!lines.length || tooMany || pending) return;
    setResult(null);
    importPlaylist.mutate(
      {
        text,
        title: title.trim() || undefined,
        visibility,
      },
      {
        onSuccess: (response) => setResult(response.data),
        onError: (error: unknown) => {
          const missed = (
            error as {
              response?: { data?: { data?: { missed?: { line: string }[] } } };
            }
          ).response?.data?.data?.missed;
          if (Array.isArray(missed) && missed.length > 0) {
            setResult({ playlist: null, matched: [], missed });
          }
        },
      },
    );
  };

  return (
    <div className="relative min-h-screen pb-28">
      <SectionAmbient />
      <header className="section-container pt-10 pb-5 sm:pt-14 sm:pb-8">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex size-6 items-center justify-center rounded-md"
            style={{
              background: "hsl(var(--brand-glow) / 0.12)",
              color: "hsl(var(--brand-glow))",
            }}
          >
            <ListMusic className="size-4" aria-hidden="true" />
          </div>
          <span className="text-overline" style={{ color: "hsl(var(--brand-glow))" }}>
            Playlist
          </span>
        </div>
        <h1 className="text-display-xl text-primary mb-2">
          Tạo playlist từ danh sách
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mỗi dòng là một tên bài hát. Có thể dán văn bản hoặc tải tệp .txt.
          Dòng dạng &quot;Nghệ sĩ - Tên bài&quot; giúp chọn đúng bài khi catalog có nhiều bản trùng tên.
        </p>
      </header>

      <main className="section-container grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="space-y-4 rounded-2xl border border-border/50 p-4 sm:p-6">
          <div className="space-y-2">
            <label htmlFor="import-title" className="text-sm text-foreground">
              Tên playlist
            </label>
            <Input
              id="import-title"
              value={title}
              maxLength={100}
              placeholder="Để trống nếu muốn đặt tên tự động"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="import-visibility" className="text-sm text-foreground">
              Hiển thị
            </label>
            <select
              id="import-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="private">Riêng tư</option>
              <option value="public">Công khai</option>
              <option value="unlisted">Không liệt kê</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="import-text" className="text-sm text-foreground">
                Danh sách bài hát
              </label>
              <button
                type="button"
                className="btn-outline btn-sm gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="size-3.5" aria-hidden="true" />
                Tải tệp .txt
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,text/plain,.csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  void onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            <Textarea
              id="import-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setResult(null);
              }}
              placeholder={"Nơi này có anh\nSơn Tùng M-TP - Lạc trôi\n1. Chúng ta của hiện tại"}
              className="min-h-64 font-mono text-sm"
            />
            <p className={tooMany ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {lines.length} dòng
              {tooMany ? `. Tối đa ${MAX_LINES} dòng mỗi lần.` : "."} Bài trùng tên chỉ được thêm một lần.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary gap-2"
            disabled={lines.length === 0 || tooMany || pending}
            onClick={submit}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Đang tìm bài hát..." : "Tạo playlist"}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/50 p-4 sm:p-6">
          <h2 className="text-lg text-foreground">Xem trước</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Dán danh sách hoặc tải tệp để xem các dòng sẽ được tìm.
            </p>
          ) : (
            <ol className="max-h-80 space-y-1 overflow-auto text-sm">
              {lines.slice(0, 12).map((line, index) => (
                <li key={`${line}-${index}`} className="truncate text-foreground">
                  {index + 1}. {line}
                </li>
              ))}
              {lines.length > 12 ? (
                <li className="text-muted-foreground">và {lines.length - 12} dòng nữa</li>
              ) : null}
            </ol>
          )}

          {result ? <ImportReport result={result} /> : null}
        </section>
      </main>
    </div>
  );
};

const ImportReport = ({ result }: { result: ImportView }) => (
  <div className="space-y-4 border-t border-border/50 pt-4">
    {result.playlist ? (
      <div className="space-y-2">
        <p className="text-sm text-foreground">
          Đã thêm {result.matched.length} bài vào &quot;{result.playlist.title}&quot;.
        </p>
        <Link
          to={CLIENT_PATHS.PLAYLIST_DETAIL(result.playlist._id)}
          className="btn-primary btn-sm inline-flex"
        >
          Mở playlist
        </Link>
      </div>
    ) : (
      <p className="text-sm text-foreground">Không tìm thấy bài hát nào trong catalog.</p>
    )}

    {result.matched.length > 0 ? (
      <div className="space-y-2">
        <h3 className="text-sm text-foreground">Đã thêm</h3>
        <ul className="max-h-64 space-y-2 overflow-auto">
          {result.matched.map((item) => (
            <li key={item.trackId} className="text-sm">
              <span className="text-foreground">{item.title}</span>
              {item.artistName ? (
                <span className="text-muted-foreground"> · {item.artistName}</span>
              ) : null}
              <span className="block truncate text-xs text-muted-foreground">{item.line}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}

    {result.missed.length > 0 ? (
      <div className="space-y-2">
        <h3 className="text-sm text-foreground">Không tìm thấy</h3>
        <ul className="max-h-48 space-y-1 overflow-auto text-sm text-muted-foreground">
          {result.missed.map((item, index) => (
            <li key={`${item.line}-${index}`}>{item.line}</li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
);

export default ImportPlaylistPage;
