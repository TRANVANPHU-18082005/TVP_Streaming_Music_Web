import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { ChartColumn, LogOut, User as UserIcon } from "lucide-react";

// Nếu bạn không muốn dùng framer-motion có thể bỏ qua,
// nhưng để UX "sướng" hơn thì giữ lại animation nhấn nhẹ này.
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { IUser } from "../types";

interface UserDropdownProps {
  user: IUser;
}

export const UserDropdown = ({ user }: UserDropdownProps) => {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="size-9 sm:size-10 border border-border/50 shadow-sm cursor-pointer">
            <AvatarImage
              src={user?.avatar}
              alt={user?.fullName || "User Avatar"}
              className="object-cover"
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
              {getInitialsTextAvartar(user?.fullName || user?.username || "U")}
            </AvatarFallback>
          </Avatar>

          {/* Online Indicator (Optional) */}
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-2" align="end" sideOffset={8}>
        {/* User Info Header */}
        <DropdownMenuLabel className="font-normal p-3 bg-muted/50 rounded-lg mb-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold text-foreground leading-none">
              {user?.fullName || user?.username || "Người dùng"}
            </p>
            <p className="text-xs text-muted-foreground truncate font-normal">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate("/profile?tab=overview")}>
            <UserIcon className="mr-2 size-4" />
            <span>Hồ sơ cá nhân</span>
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {user.role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <ChartColumn className="mr-2 size-4" />
                <span>Trang quản trị</span>
                <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-xs font-bold">
                  PRO
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Logout Item - Sử dụng variant destructive chuẩn system */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => navigate("/logout")}
        >
          <LogOut className="mr-2 size-4" />
          <span>Đăng xuất</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Helper component nhỏ cho shortcut phím tắt
function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`ml-auto text-xs tracking-widest text-muted-foreground opacity-60 ${className}`}
      {...props}
    />
  );
}

export default UserDropdown;
