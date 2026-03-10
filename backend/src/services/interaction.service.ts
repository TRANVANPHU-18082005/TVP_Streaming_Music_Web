import User from "../models/User";
import Track from "../models/Track";
import Artist from "../models/Artist"; // (Giả sử bạn có model Artist riêng hoặc dùng User role artist)

class InteractionService {
  // Toggle Like Track
  async toggleLikeTrack(userId: string, trackId: string) {
    const user = await User.findById(userId);
    const isLiked = user?.likedTracks.includes(trackId as any);

    if (isLiked) {
      // Unlike
      await User.findByIdAndUpdate(userId, { $pull: { likedTracks: trackId } });
      await Track.findByIdAndUpdate(trackId, { $inc: { likeCount: -1 } });
      return { isLiked: false };
    } else {
      // Like
      await User.findByIdAndUpdate(userId, {
        $addToSet: { likedTracks: trackId },
      });
      await Track.findByIdAndUpdate(trackId, { $inc: { likeCount: 1 } });
      return { isLiked: true };
    }
  }

  // Lấy danh sách bài đã like
  async getLikedTracks(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const user = await User.findById(userId).populate({
      path: "likedTracks",
      options: { skip, limit, sort: { createdAt: -1 } }, // Sort bài mới like lên đầu
      populate: { path: "artist", select: "fullName avatar" },
    });

    return user?.likedTracks || [];
  }
}

export default new InteractionService();
