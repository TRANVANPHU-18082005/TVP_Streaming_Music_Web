import React from "react";
import { Bell, Menu, Search } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import UserDropdown from "@/features/user/components/UserDropdown";
import { Input } from "@/components/ui/input";
import { useAppSelector } from "@/store/hooks";

interface HeaderProps {
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header: React.FC<HeaderProps> = ({ setIsSidebarOpen }) => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md transition-all lg:px-8">
      {/* --- LEFT --- */}
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden text-muted-foreground"
        >
          <Menu className="size-5" />
        </Button>

        {/* Standard Search Bar */}
        <div className="hidden md:flex relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm..."
            className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>
      </div>

      {/* --- RIGHT --- */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground rounded-full"
        >
          <Bell className="size-5" />
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-destructive border-2 border-background" />
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        <div className="flex items-center gap-2">
          <ModeToggle />
          {user && <UserDropdown user={user}/>}
        </div>
      </div>
    </header>
  );
};

export default Header;
