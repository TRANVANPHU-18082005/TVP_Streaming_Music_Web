import config from "../config/env";

/**
 * TVP Streaming Music - Email Templates
 * Simple, elegant, and highly deliverable HTML templates.
 */

const BRAND = {
  name: "TVP Streaming Music",
  logoUrl: "https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png",
  primaryColor: "#8b5cf6",
  year: new Date().getFullYear(),
};

// Layout wrapper for all emails
function wrapLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 30px 20px 20px; border-bottom: 1px solid #f0f0f0;">
              <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height: 50px; border-radius: 8px; display: block; margin-bottom: 15px;">
              <h2 style="margin: 0; font-size: 20px; color: #18181b; font-weight: 600;">${BRAND.name}</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; color: #a1a1aa; font-size: 13px;">
              <p style="margin: 0 0 10px;">Email tự động từ hệ thống ${BRAND.name}. Vui lòng không trả lời email này.</p>
              <p style="margin: 0;">&copy; ${BRAND.year} ${BRAND.name}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Components
function otpBox(otp: string): string {
  return `<div style="margin: 30px 0; text-align: center;">
    <div style="display: inline-block; padding: 15px 40px; background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b; font-family: monospace;">${otp}</div>
  </div>`;
}

function button(url: string, text: string): string {
  return `<div style="margin: 30px 0; text-align: center;">
    <a href="${url}" style="display: inline-block; padding: 14px 30px; background-color: ${BRAND.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">${text}</a>
  </div>`;
}

// 1. Register OTP
export function registerOtpEmail(otp: string, fullName: string): string {
  const content = `
    <h1 style="margin-top: 0; font-size: 22px; color: #18181b;">Xác thực tài khoản</h1>
    <p>Xin chào <strong>${fullName}</strong>,</p>
    <p>Cảm ơn bạn đã đăng ký tài khoản tại ${BRAND.name}. Dưới đây là mã OTP để hoàn tất quá trình đăng ký của bạn:</p>
    ${otpBox(otp)}
    <p style="margin-bottom: 0;"><strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng 15 phút. Tuyệt đối không chia sẻ mã này với bất kỳ ai để bảo mật tài khoản.</p>
  `;
  return wrapLayout(content);
}

// 2. Resend OTP
export function resendOtpEmail(otp: string, fullName?: string): string {
  const nameDisplay = fullName ? `<strong>${fullName}</strong>` : "bạn";
  const content = `
    <h1 style="margin-top: 0; font-size: 22px; color: #18181b;">Mã OTP mới của bạn</h1>
    <p>Xin chào ${nameDisplay},</p>
    <p>Hệ thống vừa nhận được yêu cầu gửi lại mã xác thực cho tài khoản của bạn.</p>
    ${otpBox(otp)}
    <p style="margin-bottom: 0;"><strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng 15 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
  `;
  return wrapLayout(content);
}

// 3. Forgot Password
export function forgotPasswordEmail(resetUrl: string, fullName?: string): string {
  const nameDisplay = fullName ? `<strong>${fullName}</strong>` : "bạn";
  const content = `
    <h1 style="margin-top: 0; font-size: 22px; color: #18181b;">Đặt lại mật khẩu</h1>
    <p>Xin chào ${nameDisplay},</p>
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
    ${button(resetUrl, "Đặt lại mật khẩu")}
    <p>Hoặc bạn có thể sao chép và dán đường dẫn sau vào trình duyệt:</p>
    <p style="background-color: #f4f4f5; padding: 12px; border-radius: 6px; font-size: 14px; word-break: break-all; color: #52525b;">${resetUrl}</p>
    <p style="margin-bottom: 0;">Liên kết này sẽ hết hạn sau 10 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
  `;
  return wrapLayout(content);
}

// 4. Welcome Admin Created
export function welcomeAdminCreatedEmail(
  fullName: string,
  email: string,
  tempPassword: string,
  loginUrl = `${config.clientUrl}/login`
): string {
  const content = `
    <h1 style="margin-top: 0; font-size: 22px; color: #18181b;">Chào mừng đến với ${BRAND.name}</h1>
    <p>Xin chào <strong>${fullName}</strong>,</p>
    <p>Tài khoản của bạn đã được quản trị viên tạo thành công. Dưới đây là thông tin đăng nhập của bạn:</p>
    <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0 0 10px;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0;"><strong>Mật khẩu tạm thời:</strong> <span style="font-family: monospace; font-size: 16px; background-color: #e4e4e7; padding: 2px 6px; border-radius: 4px;">${tempPassword}</span></p>
    </div>
    <p>Vui lòng đăng nhập và đổi mật khẩu ngay để bảo vệ tài khoản của bạn.</p>
    ${button(loginUrl, "Đăng nhập ngay")}
  `;
  return wrapLayout(content);
}
