import { User } from "../types";

export const exportUsersToCSV = (users: User[]) => {
  // Define CSV headers
  const headers = [
    "ID",
    "Họ và tên",
    "Username",
    "Email",
    "Role",
    "Trạng thái",
    "Xác thực",
    "Ngày tham gia",
  ];

  // Convert user data to CSV rows
  const csvRows = users.map((user) => {
    return [
      user._id,
      `"${user.fullName.replace(/"/g, '""')}"`, // Handle quotes in names
      user.username || "",
      user.email,
      user.role,
      user.isActive ? "Hoạt động" : "Bị khóa",
      user.isVerified ? "Có" : "Không",
      new Date(user.createdAt).toLocaleDateString("vi-VN"),
    ].join(",");
  });

  // Combine headers and rows
  const csvString = [headers.join(","), ...csvRows].join("\n");

  // Create a Blob from the CSV string (with BOM for Excel UTF-8 compatibility)
  const blob = new Blob(["\uFEFF" + csvString], {
    type: "text/csv;charset=utf-8;",
  });

  // Create a download link and trigger click
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `users_export_${new Date().toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
