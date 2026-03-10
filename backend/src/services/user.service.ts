import httpStatus from "http-status";
import User, { IUser } from "../models/User";
import Follow from "../models/Follow";
import Artist from "../models/Artist";
import Playlist from "../models/Playlist"; // Import thêm Playlist để cleanup
import ApiError from "../utils/ApiError";
import { generateSafeSlug } from "../utils/slug";
import { sendEmail } from "../utils/sendEmail";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  UpdateProfileInput,
  ChangePasswordInput,
  AdminCreateUserInput,
  AdminUpdateUserInput,
  UserFilterInput,
} from "../validations/user.validation";

class UserService {
  /**
   * 1. GET PUBLIC PROFILE
   * Lấy thông tin public + Check xem mình có follow họ chưa
   */
  async getPublicProfile(targetUserId: string, currentUserId?: string) {
    const user = await User.findById(targetUserId)
      .select("-password -refreshToken -email -verificationCode")
      .populate("artistProfile");

    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    // Check trạng thái follow (nếu đã login)
    let isFollowing = false;
    if (currentUserId) {
      isFollowing = !!(await Follow.exists({
        follower: currentUserId,
        following: targetUserId,
      }));
    }

    return { ...user.toObject(), isFollowing };
  }

  /**
   * 2. UPDATE PROFILE (User tự sửa)
   */
  async updateProfile(
    userId: string,
    data: UpdateProfileInput,
    file?: Express.Multer.File,
  ) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    const updateData: Partial<IUser> = { ...data };

    // --- LOGIC XỬ LÝ ẢNH ---
    if (file) {
      // 1. Xóa ảnh cũ trên Cloud (trừ ảnh default)
      if (user.avatar && !user.avatar.includes("default")) {
        await deleteFileFromCloud(user.avatar, "image");
      }
      // 2. Gán ảnh mới
      updateData.avatar = file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    return updatedUser;
  }

  /**
   * 3. CHANGE PASSWORD
   */
  async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    if (!user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Tài khoản MXH không thể đổi mật khẩu",
      );
    }

    const isMatch = await user.matchPassword(data.currentPassword);
    if (!isMatch) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mật khẩu hiện tại không đúng",
      );
    }

    user.password = data.newPassword; // Pre-save hook sẽ hash
    await user.save();

    return { success: true };
  }

  /**
   * 4. TOGGLE FOLLOW (Logic Tách Bảng)
   */
  async toggleFollow(currentUserId: string, targetId: string) {
    if (currentUserId === targetId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không thể tự follow chính mình",
      );
    }

    // Check target (User hoặc Artist)
    const targetUser = await User.findById(targetId);
    const targetArtist = !targetUser ? await Artist.findById(targetId) : null;

    if (!targetUser && !targetArtist) {
      throw new ApiError(httpStatus.NOT_FOUND, "Đối tượng không tồn tại");
    }

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: targetId,
    });

    if (existingFollow) {
      // --- UNFOLLOW ---
      await existingFollow.deleteOne();
      if (targetArtist) {
        await Artist.findByIdAndUpdate(targetId, {
          $inc: { followerCount: -1 },
        });
      }
      return { isFollowing: false };
    } else {
      // --- FOLLOW ---
      await Follow.create({
        follower: currentUserId,
        following: targetId,
      });
      if (targetArtist) {
        await Artist.findByIdAndUpdate(targetId, {
          $inc: { followerCount: 1 },
        });
      }
      return { isFollowing: true };
    }
  }

  /**
   * 5. GET USERS (Admin)
   */
  async getUsers(filter: UserFilterInput) {
    const { page, limit, keyword, role, isActive, isVerified, sort } = filter;
    const skip = (page - 1) * limit;

    const query: any = {};

    // 1. Keyword
    if (keyword) {
      query.$or = [
        { fullName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
      ];
    }

    // 2. Exact Matches
    if (role) query.role = role;

    // 🔥 SỬ DỤNG !== undefined VÌ BOOLEAN CÓ THỂ LÀ FALSE
    if (isActive !== undefined) query.isActive = isActive;
    if (isVerified !== undefined) query.isVerified = isVerified;

    // 3. Sort Logic
    let sortOption: any = { createdAt: -1 }; // Mặc định là newest

    switch (sort) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "popular":
        // Đảm bảo model User có field này nhé
        sortOption = { followersCount: -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "name":
        sortOption = { fullName: 1 }; // 🔥 Fix lỗi sai tên field
        break;
    }

    // 4. Execute
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort(sortOption)
        .lean(), // 🔥 Thêm .lean() để tối ưu hiệu năng đọc
      User.countDocuments(query),
    ]);

    return {
      data: users,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 6. [ADMIN] CREATE USER
   */
  async createUserByAdmin(
    data: AdminCreateUserInput,
    file?: Express.Multer.File,
  ) {
    const { fullName, email, password, role } = data;

    if (await User.exists({ email })) {
      if (file) await deleteFileFromCloud(file.path, "image");
      throw new ApiError(httpStatus.BAD_REQUEST, "Email đã tồn tại");
    }

    const tempPassword =
      password || Math.random().toString(36).slice(-8) + "Aa1@";
    const avatarPath = file ? file.path : "";
    const username = await generateSafeSlug(User, fullName);

    try {
      const newUser = await User.create({
        fullName,
        username,
        email,
        password: tempPassword,
        role: role || "user",
        avatar: avatarPath,
        isVerified: true,
        isActive: true,
        mustChangePassword: true,
      });

      this.sendWelcomeEmail(email, fullName, tempPassword);
      return newUser;
    } catch (error) {
      if (avatarPath) await deleteFileFromCloud(avatarPath, "image");
      throw error;
    }
  }

  /**
   * 7. [ADMIN] UPDATE USER
   * (Ban/Unban, Verify, Change Role)
   */
  async updateUserByAdmin(
    id: string,
    data: AdminUpdateUserInput,
    file?: Express.Multer.File,
  ) {
    const user = await User.findById(id);
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    if (user.role === "admin") {
      throw new ApiError(httpStatus.FORBIDDEN, "Không thể sửa Admin");
    }
    const updateData: any = {};
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password = data.password; // Admin reset pass
    // Logic ảnh
    let oldImage: string | undefined = "";
    if (file) {
      oldImage = user.avatar;
      updateData.avatar = file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    // Clean ảnh cũ
    if (file && oldImage) {
      deleteFileFromCloud(oldImage, "image").catch(console.error);
    }
    return updatedUser;
  }

  /**
   * 8. [ADMIN] DELETE USER (Hard Delete & Cleanup)
   */
  async deleteUser(id: string) {
    const user = await User.findById(id);
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    if (user.role === "admin") {
      throw new ApiError(httpStatus.FORBIDDEN, "Không thể xóa Admin");
    }

    // 1. Cleanup Follows (Ai follow user này & User này follow ai)
    await Follow.deleteMany({
      $or: [{ follower: id }, { following: id }],
    });

    // 2. Cleanup Playlists
    const playlists = await Playlist.find({ user: id });
    for (const playlist of playlists) {
      // Xóa ảnh playlist
      if (playlist.coverImage)
        deleteFileFromCloud(playlist.coverImage, "image").catch(console.error);
      await playlist.deleteOne();
    }

    // 3. Cleanup Artist Profile (Nếu có)
    if (user.artistProfile) {
      // Tùy chọn: Xóa Artist luôn hoặc Unlink
      // Ở đây chọn Unlink để an toàn (hoặc gọi ArtistService.deleteArtist nếu muốn xóa sạch)
      await Artist.findByIdAndUpdate(user.artistProfile, {
        user: null,
        isVerified: false,
      });
    }

    // 4. Xóa Avatar
    if (user.avatar && !user.avatar.includes("default")) {
      deleteFileFromCloud(user.avatar, "image").catch(console.error);
    }

    // 5. Xóa User
    await user.deleteOne();
    return { message: "Xóa user thành công" };
  }
  async toggleBlockUser(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

    // Không cho phép khóa Admin
    if (user.role === "admin")
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Không thể khóa tài khoản Admin",
      );

    user.isActive = !user.isActive;
    await user.save();

    return user;
  }
  // Helper gửi mail
  private async sendWelcomeEmail(email: string, name: string, pass: string) {
    try {
      await sendEmail(
        email,
        "Chào mừng bạn đến với hệ thống",
        `<p>Xin chào ${name}, tài khoản của bạn đã được tạo.</p><p>Pass: <b>${pass}</b></p>`,
      );
    } catch (err) {
      console.error("Gửi mail thất bại:", err);
    }
  }
}

export default new UserService();
