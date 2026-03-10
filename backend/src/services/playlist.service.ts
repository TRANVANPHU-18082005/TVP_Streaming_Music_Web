import mongoose, { Types } from "mongoose";
import httpStatus from "http-status";
import Playlist from "../models/Playlist";
import Track from "../models/Track";
import { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { generateSafeSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import { parseTags } from "../utils/helper";
import {
  CreatePlaylistInput,
  UpdatePlaylistInput,
  PlaylistFilterInput,
} from "../validations/playlist.validation";

class PlaylistService {
  // ==========================================
  // 🔴 WRITE METHODS (CREATE, UPDATE, DELETE)
  // ==========================================

  /**
   * 1. CREATE PLAYLIST
   */
  async createPlaylist(
    currentUser: IUser,
    data: CreatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const isSystemRequest = String(data.isSystem) === "true";
    if (isSystemRequest && currentUser.role !== "admin") {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Quyền hạn không đủ để tạo System Playlist",
      );
    }

    // Tách riêng hàm parse mảng ID (Dùng parseTags chung cho mảng ID/chuỗi)
    const collaboratorIds = data.collaborators
      ? parseTags(data.collaborators).map((id) => new Types.ObjectId(id))
      : [];
    const tags = data.tags ? parseTags(data.tags) : [];
    const slug = await generateSafeSlug(Playlist, data.title);
    const publishAt = data.publishAt ? new Date(data.publishAt) : new Date();

    // 🔥 CHỐNG MASS ASSIGNMENT: Chỉ lấy đúng các field an toàn
    const safeData = {
      title: data.title,
      description: data.description,
      type: data.type,
      visibility: data.visibility,
      themeColor: data.themeColor,
    };

    try {
      const newPlaylist = await Playlist.create({
        ...safeData,
        slug,
        user: currentUser._id,
        isSystem: isSystemRequest,
        coverImage: file ? file.path : "",
        publishAt,
        tags,
        collaborators: collaboratorIds,

        // Khởi tạo các mảng/bộ đếm mặc định (ngăn user tự ý truyền data ảo)
        tracks: [],
        totalTracks: 0,
        totalDuration: 0,
        followersCount: 0,
        playCount: 0,
      });

      return newPlaylist;
    } catch (error) {
      // 🔥 XÓA RÁC CLOUDINARY NẾU LƯU DB LỖI
      if (file) {
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      }
      throw error;
    }
  }

  /**
   * 2. UPDATE PLAYLIST
   */
  async updatePlaylist(
    id: string,
    currentUser: IUser,
    data: UpdatePlaylistInput,
    file?: Express.Multer.File,
  ) {
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");
    }

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";
    const isCollaborator = playlist.collaborators.some(
      (collabId) => collabId.toString() === currentUser._id.toString(),
    );

    if (!isOwner && !isAdmin && !isCollaborator) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền sửa thông tin Playlist này",
      );
    }

    const oldCoverImage = playlist.coverImage;
    let isImageUpdated = false;

    // Cập nhật dữ liệu
    if (data.title && data.title !== playlist.title) {
      playlist.title = data.title;
      // Tự động cập nhật Slug nếu đổi tên
      playlist.slug = await generateSafeSlug(Playlist, data.title);
    }

    if (data.description !== undefined) playlist.description = data.description;
    if (data.type) playlist.type = data.type;
    if (data.visibility) playlist.visibility = data.visibility;
    if (data.themeColor) playlist.themeColor = data.themeColor;
    if (data.tags) playlist.tags = parseTags(data.tags);
    if (data.collaborators)
      playlist.collaborators = parseTags(data.collaborators).map(
        (id) => new Types.ObjectId(id),
      );
    if (data.publishAt) playlist.publishAt = new Date(data.publishAt);
    if (isAdmin && data.isSystem !== undefined)
      playlist.isSystem = String(data.isSystem) === "true";

    if (file) {
      playlist.coverImage = file.path;
      isImageUpdated = true;
    }

    try {
      await playlist.save();

      // 🔥 CHỈ XÓA ẢNH CŨ KHI ĐÃ SAVE DB THÀNH CÔNG 100%
      if (
        isImageUpdated &&
        oldCoverImage &&
        !oldCoverImage.includes("default")
      ) {
        deleteFileFromCloud(oldCoverImage, "image").catch(console.error);
      }

      return playlist;
    } catch (error) {
      // 🔥 NẾU SAVE DB LỖI, XÓA NGAY ẢNH MỚI VỪA UP LÊN TRONG REQUEST NÀY
      if (file) {
        await deleteFileFromCloud(file.path, "image").catch(console.error);
      }
      throw error;
    }
  }

  /**
   * 3. DELETE PLAYLIST
   */
  async deletePlaylist(id: string, currentUser: IUser) {
    const playlist = await Playlist.findById(id);
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xóa Playlist này",
      );
    }
    if (playlist.isSystem && !isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Chỉ Admin mới được xóa Playlist hệ thống",
      );
    }

    const coverImageToDelete = playlist.coverImage;

    // 🔥 Xóa DB trước, nếu DB xóa thành công thì mới xóa file Cloudinary
    await playlist.deleteOne();

    if (coverImageToDelete && !coverImageToDelete.includes("default")) {
      deleteFileFromCloud(coverImageToDelete, "image").catch((err) =>
        console.error("⚠️ Failed to delete playlist cover:", err),
      );
    }

    return { message: "Xóa playlist thành công", _id: id };
  }

  // ==========================================
  // 🟡 TRACK MANAGEMENT (ATOMIC UPDATES)
  // ==========================================

  /**
   * 4. ADD TRACKS
   */
  async addTracks(playlistId: string, trackIds: string[], currentUser: IUser) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );
    const canEdit =
      isOwner ||
      isCollaborator ||
      (playlist.isSystem && currentUser.role === "admin");

    if (!canEdit)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền thêm bài vào Playlist này",
      );

    const validTracks = await Track.find({
      _id: { $in: trackIds },
      status: "ready",
    })
      .select("duration")
      .lean();

    if (validTracks.length === 0)
      return { message: "Không tìm thấy bài hát hợp lệ để thêm", count: 0 };

    const existingIds = new Set(playlist.tracks.map((id) => id.toString()));
    const newTracks = validTracks.filter(
      (t) => !existingIds.has(t._id.toString()),
    );

    if (newTracks.length === 0)
      return { message: "Tất cả bài hát đã có trong playlist", count: 0 };

    const addedDuration = newTracks.reduce(
      (sum, t) => sum + (t.duration || 0),
      0,
    );
    const newTrackIds = newTracks.map((t) => t._id);

    // 🔥 Dùng Atomic Update để chống Race Condition
    await Playlist.updateOne(
      { _id: playlistId },
      {
        $push: { tracks: { $each: newTrackIds } },
        $inc: { totalTracks: newTracks.length, totalDuration: addedDuration },
      },
    );

    return {
      message: `Đã thêm ${newTracks.length} bài hát`,
      count: newTracks.length,
      addedTrackIds: newTrackIds,
    };
  }

  /**
   * 5. REMOVE TRACKS
   */
  async removeTracks(
    playlistId: string,
    trackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );
    const canEdit =
      isOwner ||
      isCollaborator ||
      (playlist.isSystem && currentUser.role === "admin");

    if (!canEdit)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn không có quyền xóa bài khỏi Playlist này",
      );

    const currentTrackIdsSet = new Set(
      playlist.tracks.map((id) => id.toString()),
    );
    const validTrackIdsToRemove = trackIds.filter((id) =>
      currentTrackIdsSet.has(id),
    );

    if (validTrackIdsToRemove.length === 0)
      return { message: "Không có bài hát nào để xóa", removedCount: 0 };

    const tracksToRemoveData = await Track.find({
      _id: { $in: validTrackIdsToRemove },
    })
      .select("duration")
      .lean();
    const removedDuration = tracksToRemoveData.reduce(
      (sum, t) => sum + (t.duration || 0),
      0,
    );

    // 🔥 Atomic Pull và Decrement
    await Playlist.updateOne(
      { _id: playlistId },
      {
        $pullAll: { tracks: validTrackIdsToRemove },
        $inc: {
          totalTracks: -validTrackIdsToRemove.length,
          totalDuration: -removedDuration,
        },
      },
    );

    return {
      message: `Đã xóa ${validTrackIdsToRemove.length} bài hát`,
      removedCount: validTrackIdsToRemove.length,
      removedTrackIds: validTrackIdsToRemove,
    };
  }

  /**
   * 6. REORDER TRACKS
   */
  async reorderTracks(
    playlistId: string,
    newTrackIds: string[],
    currentUser: IUser,
  ) {
    const playlist = await Playlist.findById(playlistId).select(
      "user collaborators isSystem tracks",
    );
    if (!playlist)
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");

    const isOwner = playlist.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";
    const isCollaborator = playlist.collaborators.some(
      (id) => id.toString() === currentUser._id.toString(),
    );

    if (!isOwner && !isAdmin && !isCollaborator) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Không có quyền sắp xếp playlist này",
      );
    }

    // 🔥 Khóa chặt mảng, chỉ cho phép đảo vị trí, không cho thêm bớt
    const currentIdsSet = new Set(playlist.tracks.map((id) => id.toString()));
    const newIdsSet = new Set(newTrackIds);

    if (currentIdsSet.size !== newIdsSet.size) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Độ dài mảng bài hát không khớp dữ liệu gốc.",
      );
    }

    for (const id of newTrackIds) {
      if (!currentIdsSet.has(id)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `ID bài hát ${id} không thuộc playlist này.`,
        );
      }
    }

    const mappedObjectIds = newTrackIds.map((id) => new Types.ObjectId(id));
    await Playlist.updateOne(
      { _id: playlistId },
      { $set: { tracks: mappedObjectIds } },
    );

    return { message: "Cập nhật thứ tự thành công" };
  }

  // ==========================================
  // 🟢 READ METHODS (GET LIST & DETAIL)
  // ==========================================

  /**
   * 7. GET LIST PLAYLISTS
   */
  async getPlaylists(filter: PlaylistFilterInput, currentUser?: IUser) {
    const {
      page = 1,
      limit = 12,
      keyword,
      userId,
      isSystem,
      visibility,
      type,
      sort,
    } = filter;
    const skip = (page - 1) * limit;
    const query: any = {};

    // 🔥 Chống ReDOS Attack cho tính năng Search
    if (keyword) {
      const escapeRegex = (text: string) =>
        text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      query.title = { $regex: escapeRegex(keyword), $options: "i" };
    }

    if (type) query.type = type;
    if (isSystem !== undefined) query.isSystem = isSystem;
    if (userId) query.user = userId;

    const isOwner = userId && currentUser?._id.toString() === userId.toString();
    const isAdmin = currentUser?.role === "admin";
    const canViewAll = isAdmin || isOwner;
    console.log("canViewAll", canViewAll, "visibility filter:", visibility);
    if (canViewAll) {
      if (visibility) query.visibility = visibility;
    } else {
      // User thường: Bắt buộc Public và đã đến giờ hẹn
      query.visibility = "public";
      query.publishAt = { $lte: new Date() };
    }

    let sortOption: any = { publishAt: -1 };
    if (sort === "popular") sortOption = { playCount: -1 };
    if (sort === "followers") sortOption = { followersCount: -1 };
    if (sort === "name") sortOption = { title: 1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    const [playlists, total] = await Promise.all([
      Playlist.find(query)
        .populate("user", "fullName avatar slug")
        .select("-tracks") // Giấu mảng nặng
        .skip(skip)
        .limit(Number(limit))
        .sort(sortOption)
        .lean(),
      Playlist.countDocuments(query),
    ]);

    return {
      data: playlists,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 8. GET PLAYLIST DETAIL
   */
  async getPlaylistDetail(slugOrId: string, currentUser?: IUser) {
    const isId = mongoose.isValidObjectId(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    const playlist = await Playlist.findOne(query)
      .populate("user", "fullName avatar slug")
      .populate("collaborators", "fullName avatar slug")
      .populate({
        path: "tracks",
        match: { status: "ready", isDeleted: false },
        select: "-audioFile -status", // 🔥 BẢO MẬT: Giấu file MP3 gốc đi
        populate: [
          { path: "artist", select: "name slug" },
          { path: "album", select: "title slug coverImage type" },
        ],
      })
      .lean();

    if (!playlist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");
    }

    const isAdmin = currentUser?.role === "admin";
    const isOwner =
      currentUser &&
      playlist.user._id.toString() === currentUser._id.toString();
    const isCollaborator =
      currentUser &&
      playlist.collaborators.some(
        (c: any) => c._id.toString() === currentUser._id.toString(),
      );
    const hasAccess = isAdmin || isOwner || isCollaborator;

    if (!hasAccess) {
      if (playlist.visibility === "private") {
        throw new ApiError(httpStatus.FORBIDDEN, "Đây là Playlist riêng tư");
      }
      if (new Date(playlist.publishAt) > new Date()) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          "Playlist chưa được công khai",
        );
      }
    }

    return playlist;
  }
}

export default new PlaylistService();
