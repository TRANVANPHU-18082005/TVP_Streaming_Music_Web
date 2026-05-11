import nodemailer from "nodemailer";
import config from "../config/env";

export const sendEmail = async (to: string, subject: string, html: string) => {
  // Cấu hình SMTP (Ví dụ dùng Gmail App Password)
  // Bạn nên để biến môi trường trong .env
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
  });

  await transporter.sendMail({
    from: '"Music App" <no-reply@musicapp.com>',
    to,
    subject,
    html,
  });
};
