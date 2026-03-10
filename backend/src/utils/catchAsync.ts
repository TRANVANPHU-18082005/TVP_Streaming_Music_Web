import { Request, Response, NextFunction } from "express";

// Định nghĩa kiểu cho hàm Controller (Async)
type AsyncController = (
  req: Request<any, any, any, any>, // Chấp nhận mọi kiểu Generic cho req
  res: Response,
  next: NextFunction
) => Promise<any>;

const catchAsync = (fn: AsyncController) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Thực thi hàm fn, nếu có lỗi (Promise reject) thì gọi next(err)
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

export default catchAsync;
