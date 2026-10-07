import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { CLIENT_PATHS } from "@/config/paths";
import { buildShareUrl } from "@/utils/share";
import { qrMatrix } from "../utils/qr";

interface Props {
  roomCode: string;
  isPublic: boolean;
  onClose: () => void;
}

export const RoomShareSheet = ({ roomCode, isPublic, onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  const link = buildShareUrl(`/${CLIENT_PATHS.ROOMS}/${roomCode}`);
  const matrix = qrMatrix(link);
  const size = matrix.length;
  const cell = 4;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 p-4 sm:items-center">
      <div className="glass-frosted shadow-floating w-full max-w-sm rounded-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Chia sẻ phòng</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-3">
          <svg width={size * cell} height={size * cell} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Mã QR phòng">
            {matrix.flatMap((row, y) =>
              row.map((dark, x) =>
                dark ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111" /> : null,
              ),
            )}
          </svg>
        </div>
        <p className="text-center text-2xl font-bold tracking-[0.3em]">{roomCode}</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {isPublic
            ? "Gửi link hoặc mã phòng. Mật khẩu không nằm trong link."
            : "Phòng riêng: gửi link kèm mật khẩu riêng, không dán mật khẩu vào đường dẫn."}
        </p>
        <button
          type="button"
          onClick={() => void copy()}
          className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Đã chép link" : "Chép link phòng"}
        </button>
      </div>
    </div>
  );
};
