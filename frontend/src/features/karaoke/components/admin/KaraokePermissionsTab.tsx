import { useState } from "react";
import { format } from "date-fns";
import { Search, Plus, ShieldOff, ShieldAlert, Check } from "lucide-react";
import { useAdminPermissions } from "../../hooks/useKaraokeQueries";
import { useAdminGrantPermission, useAdminRevokePermission } from "../../hooks/useKaraokeMutations";
import { IKaraokePermission } from "../../types";
import { QueryErrorResult } from "@/components/ui/QueryState";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Pagination, { PaginationStrip } from "@/utils/pagination";
import { UserSelectModal } from "./UserSelectModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

const KaraokePermissionsTab = () => {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [isUserSelectOpen, setIsUserSelectOpen] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminPermissions({
    page,
    limit: 10,
    keyword: keyword || undefined,
  });

  const { mutate: grantPermission } = useAdminGrantPermission();
  const { mutate: revokePermission } = useAdminRevokePermission();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput);
    setPage(1);
  };

  const handleGrantNew = () => {
    setIsUserSelectOpen(true);
  };

  const onUserSelected = (userId: string) => {
    setIsUserSelectOpen(false);
    grantPermission({
      userId,
      payload: {
        uploadEnabled: true,
        uploadLimit: 5, // Default
        maxDuration: 600, // 10 mins
        maxFileSize: 50 * 1024 * 1024, // 50MB
      }
    });
  };

  const handleRevoke = (userId: string) => {
    setUserToRevoke(userId);
  };

  const confirmRevoke = () => {
    if (userToRevoke) {
      revokePermission(userToRevoke);
      setUserToRevoke(null);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between gap-4 rounded-md bg-muted/30 p-3">
        <form onSubmit={handleSearch} className="flex flex-1 max-w-sm gap-2">
          <Input
            placeholder="Tìm kiếm email, username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-background"
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <Button onClick={handleGrantNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Cấp quyền mới
        </Button>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Hạn mức Upload</TableHead>
              <TableHead>Đã dùng</TableHead>
              <TableHead>Giới hạn Audio</TableHead>
              <TableHead>Người cấp</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  Đang tải dữ liệu...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="p-6">
                  <QueryErrorResult error={error} onRetry={() => void refetch()} size="sm" />
                </TableCell>
              </TableRow>
            ) : !data?.data?.data?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  Chưa có phân quyền nào được cấp.
                </TableCell>
              </TableRow>
            ) : (
              data.data.data.map((permission: IKaraokePermission) => (
                <TableRow key={permission._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={permission.user.avatar} />
                        <AvatarFallback>{permission.user.username.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{permission.user.fullName}</span>
                        <span className="text-xs text-muted-foreground">@{permission.user.username}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {permission.uploadEnabled ? (
                      <span className="flex items-center gap-1 text-sm text-green-500 font-medium">
                        <Check className="h-4 w-4" /> Khả dụng
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
                        <ShieldOff className="h-4 w-4" /> Đã thu hồi
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    {permission.uploadLimit === -1 ? "Không giới hạn" : `${permission.uploadLimit} bản thu`}
                  </TableCell>

                  <TableCell>
                    {permission.uploadsUsed}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col text-sm text-muted-foreground">
                      <span>Max: {permission.maxDuration / 60} phút</span>
                      <span>Max: {(permission.maxFileSize / 1024 / 1024).toFixed(0)} MB</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{(permission.grantedBy as any).username}</span>
                      <span className="text-xs">{format(new Date(permission.grantedAt), "dd/MM/yyyy")}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    {permission.uploadEnabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white"
                        onClick={() => handleRevoke(permission.user._id)}
                      >
                        <ShieldAlert className="mr-1 h-3 w-3" /> Thu hồi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION */}
      {!isLoading && data?.data?.meta && data.data.meta.totalPages > 1 && (
        <PaginationStrip
          currentPage={page}
          totalPages={data.data.meta.totalPages}
          onPageChange={setPage}
          totalItems={data.data.meta.total || data.data.meta.totalItems || 0}
          pageSize={data.data.meta.limit || data.data.meta.pageSize || 10}
        />
      )}

      {/* MODALS */}
      <UserSelectModal
        isOpen={isUserSelectOpen}
        onClose={() => setIsUserSelectOpen(false)}
        onSelect={onUserSelected}
        title="Chọn người dùng cấp quyền Karaoke"
      />

      <ConfirmationModal
        isOpen={!!userToRevoke}
        title="Thu hồi quyền Upload"
        description="Bạn có chắc chắn muốn thu hồi quyền upload Karaoke của người dùng này? Các bản thu hiện tại của họ vẫn sẽ được giữ lại, nhưng họ sẽ không thể upload bản thu mới."
        confirmLabel="Thu hồi"
        cancelLabel="Hủy"
        onConfirm={confirmRevoke}
        onCancel={() => setUserToRevoke(null)}
        variant="destructive"
      />

    </div>
  );
};

export default KaraokePermissionsTab;
