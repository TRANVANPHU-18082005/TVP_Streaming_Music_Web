import nodemailer from "nodemailer";
import config from "../config/env";

export const sendEmail = async (to: string, subject: string, html: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.emailUser,
      pass: config.emailPass,
    },
  });

  // Tạo nội dung plain text đơn giản để giảm điểm spam
  const plainText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  await transporter.sendMail({
    from: `"TVP Streaming Music" <${config.emailUser}>`,
    to,
    subject,
    text: plainText,
    html,
  });
};
