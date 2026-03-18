import { useState } from "react";
import { Outlet } from "react-router-dom";
import { usePlayerPadding } from "@/hooks/usePlayerPadding";
import { cn } from "@/lib/utils";
import Sidebar from "@/layouts/admin/components/Sidebar";
import Header from "@/layouts/admin/components/Header";

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const paddingProps = usePlayerPadding(20);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    // Wrapper chính: h-screen và overflow-hidden để tránh scroll body
    <div className="relative flex h-screen w-full bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* SIDEBAR
        - Desktop: Nó là flex item, tự chiếm chỗ.
        - Mobile: Nó được xử lý position fixed bên trong component Sidebar.
      */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isCollapsed={isCollapsed}
        toggleSidebar={toggleSidebar}
      />

      {/* MAIN CONTENT WRAPPER
        - flex-1: Chiếm hết khoảng trống còn lại bên phải Sidebar
        - flex-col: Header ở trên, Content ở dưới
        - min-w-0: Fix lỗi flexbox text overflow
      */}
      <div className="flex flex-1 flex-col min-w-0 transition-all duration-300">
        <Header setIsSidebarOpen={setIsSidebarOpen} />

        {/* SCROLLABLE AREA */}
        <main
          className={cn(
            "flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 scroll-smooth bg-muted/20", // Thêm bg-muted/20 để tách biệt với header/sidebar trắng
            paddingProps.className,
          )}
          style={paddingProps.style}
        >
          {/* Max width container để nội dung không bị bè ra quá rộng trên màn hình 4k */}
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Overlay (Nằm ngoài cùng để đè lên tất cả khi mở menu mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout;
