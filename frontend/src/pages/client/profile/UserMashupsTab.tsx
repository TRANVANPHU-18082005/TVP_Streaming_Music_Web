import React from "react";
import { useMyMashups } from "@/features/mashup/hooks/useMashups";
import { MashupCard } from "@/features/mashup/components/MashupCard";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { Layers, Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const UserMashupsTab = () => {
  const { data: mashupRes, isLoading, isError } = useMyMashups({ limit: 50 });
  const mashups = mashupRes?.data?.mashups || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground mb-4">Không thể tải danh sách Mashup.</p>
      </div>
    );
  }

  if (mashups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/50 rounded-2xl bg-surface-1/30">
        <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4 text-muted-foreground">
          <Layers className="w-8 h-8 opacity-50" />
        </div>
        <h3 className="text-xl font-bold mb-2">Chưa có Mashup nào</h3>
        <p className="text-muted-foreground max-w-sm mb-6 text-sm">
          Bạn chưa tạo hoặc lưu bản nháp Mashup nào. Hãy thử công cụ AI Auto-Mix để tạo nên những bản phối độc đáo nhé!
        </p>
        <Link
          to="/mashups/studio"
          className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 rounded-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Đến Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Mashup của bạn <span className="text-muted-foreground text-sm font-normal">({mashupRes?.data?.total || mashups.length})</span>
        </h3>
        <Link
          to="/mashups/studio"
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
        >
          Tạo mới <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6">
        {mashups.map((mashup: any, i: number) => (
          <motion.div
            key={mashup._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="relative group"
          >
            <MashupCard mashup={mashup} variant="default" />
            
            {/* Hiển thị Nhãn "Bản nháp" nếu chưa publish */}
            {!mashup.isPublished && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 text-white shadow-lg pointer-events-none">
                  Bản nháp
                </Badge>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default UserMashupsTab;
