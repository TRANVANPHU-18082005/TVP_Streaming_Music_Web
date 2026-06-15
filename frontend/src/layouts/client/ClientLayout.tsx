import { CLIENT_PATHS } from "@/config/paths";
import { usePlayerPadding } from "@/hooks/usePlayerPadding";
import { Footer } from "@/layouts/client/components/Footer";
import { Header } from "@/layouts/client/components/Header";
import { cn } from "@/lib/utils";
import { Outlet, useLocation } from "react-router-dom";

const ClientLayout = () => {
  // Hook tính toán khoảng cách an toàn cho Player bar
  const playerPaddingClass = usePlayerPadding(120);
  const location = useLocation();
  const isForMePage = location.pathname === `/${CLIENT_PATHS.FOR_ME}`;

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col bg-background font-sans antialiased text-foreground",
        // Thêm transition mượt mà khi đổi theme
        "transition-colors duration-300",
        playerPaddingClass
      )}
    >
      {/* Ẩn Global Header trên For Me page — ForMeHeader riêng được render trong ForMePage */}
      {!isForMePage && <Header />}

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-0">
        <Outlet />
      </main>

      <Footer />

      {/* Player thường được render ở root hoặc portal, nhưng layout cần chừa chỗ */}
    </div>
  );
};

export default ClientLayout;
