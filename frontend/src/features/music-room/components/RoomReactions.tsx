// features/music-room/components/RoomReactions.tsx
/**
 * Floating emoji reactions bay lên từ dưới màn hình.
 * Animations CSS thuần.
 */

import React, { memo } from "react";
import { useSelector } from "react-redux";
import { selectFloatingReactions } from "../store/roomSlice";
import type { FloatingReaction } from "../types/room.types";
import { ALLOWED_REACTIONS } from "../types/room.types";

interface ReactionButtonsProps {
  onReact: (emoji: string) => void;
}

/** Thanh nút chọn reaction */
export const ReactionButtons = memo(({ onReact }: ReactionButtonsProps) => (
  <div className="flex gap-2 flex-wrap justify-center">
    {ALLOWED_REACTIONS.map((emoji) => (
      <button
        key={emoji}
        id={`reaction-btn-${emoji.codePointAt(0)}`}
        onClick={() => onReact(emoji)}
        className="text-2xl hover:scale-125 active:scale-95 transition-transform duration-150 cursor-pointer select-none"
        aria-label={`React with ${emoji}`}
      >
        {emoji}
      </button>
    ))}
  </div>
));
ReactionButtons.displayName = "ReactionButtons";

/** Floating reactions overlay */
const FloatingReactionItem = memo(({ reaction }: { reaction: FloatingReaction }) => (
  <div
    className="absolute bottom-0 pointer-events-none text-3xl"
    style={{
      left: `${reaction.x}%`,
      animation: "float-emoji 3s ease-out forwards",
    }}
  >
    {reaction.emoji}
  </div>
));
FloatingReactionItem.displayName = "FloatingReactionItem";

/** Container chứa tất cả floating reactions */
const RoomReactions = memo(() => {
  const reactions = useSelector(selectFloatingReactions);

  return (
    <>
      <style>{`
        @keyframes float-emoji {
          0% { transform: translateY(0) scale(0.5); opacity: 1; }
          70% { transform: translateY(-200px) scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-300px) scale(0.8); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
        {reactions.map((r) => (
          <FloatingReactionItem key={r.id} reaction={r} />
        ))}
      </div>
    </>
  );
});
RoomReactions.displayName = "RoomReactions";
export default RoomReactions;
