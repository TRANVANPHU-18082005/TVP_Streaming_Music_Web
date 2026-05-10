import VerificationRequest from "../models/VerificationRequest";
import Artist from "../models/Artist";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import mongoose from "mongoose";

class VerificationService {
  /**
   * 1. USER: GỬI YÊU CẦU
   */
  async submitRequest(
    currentUser: IUser,
    data: any,
    files?: Express.Multer.File[]
  ) {
    // Check xem đã có yêu cầu nào đang pending không
    const existing = await VerificationRequest.findOne({
      user: currentUser._id,
      status: "pending",
    });
    if (existing)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Bạn đang có một yêu cầu chờ duyệt"
      );

    const idCardImages = files?.map((f) => f.path) || [];

    return await VerificationRequest.create({
      ...data,
      user: currentUser._id,
      idCardImages,
    });
  }

  /**
   * 2. ADMIN: LẤY DANH SÁCH YÊU CẦU
   */
  async getRequests(status: "pending" | "approved" | "rejected" = "pending", page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = { status };

    const [requests, total] = await Promise.all([
      VerificationRequest.find(query as any)
        .populate("user", "fullName email avatar") // Xem ai gửi
        .populate("artistId", "name coverImage") // Xem họ claim artist nào (nếu có)
        .sort({ createdAt: 1 }) // Đơn cũ nhất lên đầu
        .skip(skip)
        .limit(limit),
      VerificationRequest.countDocuments(query),
    ]);

    return {
      data: requests,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 3. ADMIN: DUYỆT / TỪ CHỐI
   */
  async reviewRequest(
    requestId: string,
    status: "approved" | "rejected",
    reason?: string
  ) {
    const request = await VerificationRequest.findById(requestId);
    if (!request)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy yêu cầu");
    if (request.status !== "pending")
      throw new ApiError(httpStatus.BAD_REQUEST, "Yêu cầu này đã được xử lý");

    // --- TRƯỜNG HỢP TỪ CHỐI ---
    if (status === "rejected") {
      request.status = "rejected";
      request.rejectReason = reason;
      await request.save();
      // TODO: Gửi email thông báo cho user lý do từ chối
      return { message: "Đã từ chối yêu cầu" };
    }

    // --- TRƯỜNG HỢP DUYỆT (APPROVED) ---
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let artist;

      // Case A: Claim Artist có sẵn
      if (request.artistId) {
        artist = await Artist.findById(request.artistId).session(session);
        if (!artist) throw new Error("Artist cần claim không tồn tại");
        if (artist.user) throw new Error("Artist này đã có người sở hữu");
      }
      // Case B: Tạo Artist mới
      else {
        artist = new Artist({
          name: request.artistName,
          // Mặc định các trường khác...
        });
      }

      // Cập nhật thông tin Artist
      artist.isVerified = true; // ✅ Cấp tích xanh
      artist.user = request.user; // 🔗 Link với User
      await artist.save({ session });

      // Cập nhật User (Nâng role lên Artist nếu cần)
      await User.findByIdAndUpdate(request.user, { role: "artist" }).session(
        session
      );

      // Cập nhật Request
      request.status = "approved";
      await request.save({ session });

      await session.commitTransaction();
      // TODO: Gửi email chúc mừng
      return { message: "Đã phê duyệt! User đã trở thành Artist." };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default new VerificationService();
