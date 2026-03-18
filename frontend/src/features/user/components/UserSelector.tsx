import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  X,
  Loader2,
  Users as UsersIcon,
  ListFilter,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// Utils & Hooks
import { getInitialsTextAvartar } from "@/utils/genTextAvartar";
import { useDebounce } from "@/hooks/useDebounce";
import { useUsersQuery } from "@/features/user/hooks/useUsersQuery";
import type { User } from "@/features/user/types";

// --- Props ---
interface UserSelectorProps {
  label?: string;
  required?: boolean;
  error?: string;

  // Hỗ trợ cả mảng (Multi), ID đơn (Single), hoặc undefined (All/Empty)
  value: string | string[] | null | undefined;
  onChange: (val: any) => void;

  singleSelect?: boolean;
  excludeIds?: string[];
  className?: string;
  placeholder?: string;

  // Phân biệt ngữ cảnh sử dụng
  variant?: "form" | "filter";

  // Tuỳ chọn để fetch user ban đầu nếu API phân trang không chứa user đang chọn
  initialUsers?: User | User[] | null;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  label,
  required,
  error,
  value,
  onChange,
  singleSelect = false,
  excludeIds = [],
  className,
  placeholder = "Chọn người dùng...",
  variant = "form",
  initialUsers,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  // 1. Fetch Users từ API (Có Search và Phân trang nhẹ)
  const { data: userRes, isLoading } = useUsersQuery({
    page: 1,
    limit: 15,
    keyword: debouncedSearch,
  });

  const fetchedUsers = useMemo(() => userRes?.users || [], [userRes]);

  // 2. Chuẩn hóa giá trị đang chọn thành mảng ID
  const selectedIds = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // 3. Ghép danh sách User để hiển thị thông tin đầy đủ (Tên, Avatar)
  const displayUsers = useMemo(() => {
    const initialArr = Array.isArray(initialUsers)
      ? initialUsers
      : initialUsers
        ? [initialUsers]
        : [];

    // Gộp fetched và initial, loại bỏ trùng lặp và loại trừ excludeIds
    const pool = [...initialArr, ...fetchedUsers].filter(
      (u, index, self) =>
        index === self.findIndex((t) => t._id === u._id) &&
        !excludeIds.includes(u._id),
    );

    return pool;
  }, [fetchedUsers, initialUsers, excludeIds]);

  // Lấy chi tiết các user đang được chọn để hiển thị Tag
  const selectedUserDetails = useMemo(() => {
    return selectedIds
      .map((id) => displayUsers.find((u) => u._id === id))
      .filter(Boolean) as User[];
  }, [selectedIds, displayUsers]);

  // --- CORE LOGIC: Handle Select ---
  const handleSelect = (id: string | undefined) => {
    if (singleSelect) {
      onChange(id === value ? undefined : id);
      setIsOpen(false);
      return;
    }

    // Multi-select logic
    if (!id) return;
    const isSelected = selectedIds.includes(id);
    onChange(
      isSelected
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* --- LABEL --- */}
      {label && (
        <Label className="text-xs font-bold uppercase text-foreground/80 tracking-wider flex items-center gap-1.5 ml-0.5">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {/* --- MAIN CONTAINER --- */}
      <div
        className={cn(
          "border border-input rounded-lg bg-background shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20",
          error && "border-destructive focus-within:ring-destructive/20",
        )}
      >
        {/* Search Input (Giả lập Select Trigger) */}
        <div className="relative border-b border-border/50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            className="w-full h-10 pl-9 pr-4 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Delay để click list hoạt động
          />
        </div>

        {/* List (Chỉ hiện khi Focus) */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            isOpen ? "max-h-[260px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-xs font-medium tracking-wide">
                  Đang tìm kiếm...
                </span>
              </div>
            ) : (
              <>
                {/* --- TÙY CHỌN: TẤT CẢ (CHO FILTER) --- */}
                {variant === "filter" && !searchTerm && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(undefined);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors select-none",
                      value === undefined
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50 text-foreground",
                    )}
                  >
                    <ListFilter className="size-4 opacity-70" />
                    <span className="flex-1">Tất cả người dùng</span>
                    {value === undefined && <Check className="size-4" />}
                  </div>
                )}

                {/* --- DANH SÁCH USERS --- */}
                {displayUsers.map((user) => {
                  const isSelected = selectedIds.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(user._id);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors select-none",
                        isSelected ? "bg-primary/10" : "hover:bg-accent",
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="size-8 border border-border">
                          <AvatarImage
                            src={user.avatar}
                            className="object-cover"
                          />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                            {getInitialsTextAvartar(user.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -right-1 -bottom-1 bg-primary text-white rounded-full p-0.5 border-2 border-background shadow-sm">
                            <Check className="size-2.5 stroke-[4]" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm truncate leading-tight",
                            isSelected
                              ? "font-bold text-primary"
                              : "font-medium text-foreground",
                          )}
                        >
                          {user.fullName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Multi-select check box giả */}
                      {!singleSelect && (
                        <div
                          className={cn(
                            "size-4 rounded-sm border-2 flex items-center justify-center transition-colors shrink-0",
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {isSelected && (
                            <Check className="size-3 text-white stroke-[4]" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Không có dữ liệu */}
                {displayUsers.length === 0 && !isLoading && (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <UserCircle className="size-8 opacity-20" />
                    <span className="text-xs uppercase font-bold tracking-widest opacity-60">
                      Không tìm thấy
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- HIỂN THỊ TAGS CHO MULTI-SELECT (HOẶC SINGLE KHI ĐÃ ĐÓNG) --- */}
      {selectedUserDetails.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in zoom-in-95 duration-200">
          {selectedUserDetails.map((user) => (
            <Badge
              key={user._id}
              variant="secondary"
              className="pl-1 pr-1.5 py-1 h-8 text-xs border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Avatar className="size-5">
                <AvatarImage src={user.avatar} className="object-cover" />
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                  {getInitialsTextAvartar(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold max-w-[120px] truncate">
                {user.fullName}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(user._id);
                }}
                className="size-4 rounded-full hover:bg-destructive hover:text-white flex items-center justify-center transition-colors ml-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* --- LỖI VALIDATION --- */}
      {error && (
        <p className="text-[11px] font-bold text-destructive animate-in slide-in-from-left-1">
          {error}
        </p>
      )}
    </div>
  );
};
export default UserSelector;
