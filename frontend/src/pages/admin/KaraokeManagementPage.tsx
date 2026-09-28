import { useState } from "react";
import { Mic2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Hooks
import { useAdminPermissions, useAdminRecordings } from "@/features/karaoke/hooks/useKaraokeQueries";
import { useAdminReviewRecording, useAdminGrantPermission, useAdminRevokePermission } from "@/features/karaoke/hooks/useKaraokeMutations";

// We will build these sub-components shortly
import KaraokeRecordingsTab from "@/features/karaoke/components/admin/KaraokeRecordingsTab";
import KaraokePermissionsTab from "@/features/karaoke/components/admin/KaraokePermissionsTab";

const KaraokeManagementPage = () => {
  const [activeTab, setActiveTab] = useState("recordings");

  return (
    <div className="flex h-full w-full flex-col space-y-6 p-8 overflow-hidden">
      <PageHeader
        title="Karaoke Management"
        subtitle="Quản lý các bản thu âm Karaoke của người dùng và cấp quyền upload."
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col space-y-4 overflow-hidden"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="recordings" className="flex items-center gap-2">
            <Mic2 className="h-4 w-4" />
            Bản thu chờ duyệt
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Quản lý quyền Upload
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto rounded-lg border bg-card text-card-foreground shadow-sm">
          <TabsContent
            value="recordings"
            className="m-0 h-full p-4 data-[state=inactive]:hidden"
          >
            <KaraokeRecordingsTab />
          </TabsContent>
          <TabsContent
            value="permissions"
            className="m-0 h-full p-4 data-[state=inactive]:hidden"
          >
            <KaraokePermissionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default KaraokeManagementPage;
