import { useState } from "react";
import { Plus, Search, TvMinimalPlay, Edit, Trash2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useShorts, useCreateShort, useUpdateShort, useDeleteShort, useTogglePublish } from "../hooks/useShorts";
import { ShortEditor } from "../components/ShortEditor";
import { ITrackShort } from "../types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import TableSkeleton from "@/components/ui/TableSkeleton";

export const ShortsManagementPage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingShort, setEditingShort] = useState<ITrackShort | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useShorts({ limit: 50, search });
  const createShort = useCreateShort();
  const updateShort = useUpdateShort();
  const deleteShort = useDeleteShort();
  const togglePublish = useTogglePublish();

  const handleAddNew = () => {
    setEditingShort(null);
    setIsEditing(true);
  };

  const handleEdit = (short: ITrackShort) => {
    setEditingShort(short);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa Short này?")) {
      deleteShort.mutate(id, {
        onSuccess: () => toast.success("Đã xóa Short thành công")
      });
    }
  };

  const handleTogglePublish = (id: string, isPublished: boolean) => {
    togglePublish.mutate({ id, isPublished }, {
      onSuccess: () => toast.success("Cập nhật trạng thái thành công")
    });
  };

  const handleSubmit = (formData: any) => {
    if (editingShort) {
      updateShort.mutate({ id: editingShort._id, data: formData }, {
        onSuccess: () => {
          toast.success("Cập nhật Short thành công");
          setIsEditing(false);
        }
      });
    } else {
      createShort.mutate(formData, {
        onSuccess: () => {
          toast.success("Tạo mới Short thành công");
          setIsEditing(false);
        }
      });
    }
  };

  if (isEditing) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            ← Quay lại
          </Button>
          <h1 className="text-2xl font-bold">{editingShort ? "Chỉnh sửa Short" : "Tạo Short mới"}</h1>
        </div>
        <div className="flex-1 overflow-auto bg-card rounded-xl border border-border p-2 shadow-sm">
          <ShortEditor
            initialData={editingShort || {}}
            onSubmit={handleSubmit}
            onCancel={() => setIsEditing(false)}
            isLoading={createShort.isPending || updateShort.isPending}
          />
        </div>
      </div>
    );
  }

  const shortsList = data?.data?.data || [];

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <TvMinimalPlay className="w-6 h-6" />
            </div>
            Music Shorts
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Quản lý các đoạn cắt ngắn (highlight) để hiển thị trên Shorts Feed.
          </p>
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm tiêu đề, bài hát..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 focus-visible:ring-primary"
            />
          </div>
          <Button onClick={handleAddNew} className="flex gap-2 shadow-md">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tạo mới</span>
          </Button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="flex-1 overflow-hidden bg-card/50 backdrop-blur-sm rounded-xl border border-border flex flex-col shadow-sm">
        <div className="flex-1 overflow-auto relative">
          <Table>
            <TableHeader className="bg-background/80 sticky top-0 z-10 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">Thumbnail</TableHead>
                <TableHead>Thông tin Track</TableHead>
                <TableHead className="hidden md:table-cell">Caption / Tùy chỉnh</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Tương tác</TableHead>
                <TableHead className="text-center">Hiển thị</TableHead>
                <TableHead className="text-right pr-6">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <TableSkeleton rows={5} cols={6} />
                  </TableCell>
                </TableRow>
              ) : shortsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <TvMinimalPlay className="w-12 h-12 mb-4 opacity-20" />
                      <p>Không tìm thấy Short nào.</p>
                      <Button variant="link" onClick={handleAddNew} className="mt-2 text-primary">
                        Tạo Short đầu tiên
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                shortsList.map((short) => (
                  <TableRow key={short._id} className="group hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="relative w-16 h-24 rounded-md overflow-hidden bg-muted border border-border">
                        <ImageWithFallback
                          src={short.moodVideo?.thumbnailUrl || short.track?.coverImage}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm px-1 rounded text-[10px] font-medium text-white">
                          {short.duration?.toFixed(1)}s
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col max-w-[200px]">
                        <span className="font-semibold truncate text-foreground" title={short.track?.title}>
                          {short.track?.title}
                        </span>
                        <span className="text-sm text-muted-foreground truncate" title={short.track?.artist?.name}>
                          {short.track?.artist?.name}
                        </span>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {short.startTime?.toFixed(0)}s - {short.endTime?.toFixed(0)}s
                          </Badge>
                          {short.suggestedByAi && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                              AI Suggested
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell max-w-[250px]">
                      <div className="flex flex-col gap-1">
                        {short.title && <span className="font-medium text-sm truncate">"{short.title}"</span>}
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {short.caption || "Không có caption"}
                        </span>
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Priority: {short.priority}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center hidden sm:table-cell">
                      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>{short.viewCount || 0} lượt xem</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-pink-500/80">❤ {short.likeCount || 0}</span>
                          <span className="text-blue-500/80">➦ {short.shareCount || 0}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={short.isPublished}
                          onCheckedChange={(checked) => handleTogglePublish(short._id, checked)}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors"
                          onClick={() => handleEdit(short)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive transition-colors"
                          onClick={() => handleDelete(short._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* FOOTER Paginator placeholder (if needed) */}
        {!isLoading && shortsList.length > 0 && (
          <div className="border-t border-border p-3 text-xs text-muted-foreground text-center bg-background/50">
            Hiển thị {shortsList.length} shorts.
          </div>
        )}
      </div>
    </div>
  );
};
