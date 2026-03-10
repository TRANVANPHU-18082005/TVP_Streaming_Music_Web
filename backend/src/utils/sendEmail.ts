import nodemailer from "nodemailer";

export const sendEmail = async (to: string, subject: string, html: string) => {
  // Cấu hình SMTP (Ví dụ dùng Gmail App Password)
  // Bạn nên để biến môi trường trong .env
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: '"Music App" <no-reply@musicapp.com>',
    to,
    subject,
    html,
  });
};
