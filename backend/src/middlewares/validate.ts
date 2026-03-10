import { Request, Response, NextFunction } from "express";
import { ZodError, ZodObject } from "zod";
import { deleteFromB2, deleteFromCloudinary } from "../utils/fileCleanup";

// Dùng ZodObject<any, any> để nhận mọi schema object
type RequestSchema = ZodObject<any, any>;

const validate =
  (schema: RequestSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Parse & Transform dữ liệu
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // A. Xử lý BODY (Thường gán đè được, nhưng cẩn thận vẫn tốt hơn)
      if (validatedData.body) {
        req.body = validatedData.body;
      }

      // B. Xử lý QUERY (Nguyên nhân gây lỗi 500 của bạn)
      if (validatedData.query) {
        // req.query là Getter, không gán đè được.
        // Giải pháp: Xóa sạch key cũ -> Copy key mới vào object cũ.
        for (const key in req.query) {
          delete (req.query as any)[key];
        }
        Object.assign(req.query, validatedData.query);
      }

      // C. Xử lý PARAMS (Tương tự Query)
      if (validatedData.params) {
        for (const key in req.params) {
          delete (req.params as any)[key];
        }
        Object.assign(req.params, validatedData.params);
      }

      return next();
    } catch (error) {
      // =========================================================
      // 🛑 AUTO CLEANUP
      // =========================================================
      try {
        let filesToDelete: any[] = [];

        if (req.file) filesToDelete.push(req.file);

        if (req.files) {
          if (Array.isArray(req.files)) {
            filesToDelete.push(...req.files);
          } else {
            const fileGroups = Object.values(req.files);
            filesToDelete.push(...fileGroups.flat());
          }
        }

        if (filesToDelete.length > 0) {
          filesToDelete.forEach((file) => {
            if (file.key) {
              deleteFromB2(file.key).catch((err) =>
                console.error("Cleanup B2 failed:", err),
              );
            } else if (file.filename) {
              deleteFromCloudinary(file.filename).catch((err) =>
                console.error("Cleanup Cloudinary failed:", err),
              );
            }
          });
        }
      } catch (cleanupError) {
        console.error("⚠️ Auto-cleanup logic error:", cleanupError);
      }

      // =========================================================
      // 3. FORMAT LỖI TRẢ VỀ
      // =========================================================

      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");

        return res.status(400).json({
          success: false,
          status: "error",
          message: errorMessage,
        });
      }

      console.error("❌ Middleware Validation Error:", error);

      return res.status(500).json({
        success: false,
        status: "error",
        message: "Internal Server Error",
      });
    }
  };

export default validate;
