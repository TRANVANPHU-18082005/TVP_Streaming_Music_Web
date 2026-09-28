import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { useUsersQuery } from "@/features/user/hooks/useUsersQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from "@/hooks/useDebounce";

interface UserSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  title?: string;
}

export const UserSelectModal = ({
  isOpen,
  onClose,
  onSelect,
  title = "Chọn người dùng",
}: UserSelectModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const { data, isLoading } = useUsersQuery({
    page: 1,
    limit: 10,
    keyword: debouncedSearch,
  });

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const users = data?.users || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Tìm kiếm theo email, tên hiển thị hoặc username để chọn người dùng.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm người dùng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="mt-4 h-[300px] rounded-md border p-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Không tìm thấy người dùng nào.
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => onSelect(user._id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.username.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium text-sm truncate">
                      {user.fullName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      @{user.username} • {user.email}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="mt-2 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Hủy bỏ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
