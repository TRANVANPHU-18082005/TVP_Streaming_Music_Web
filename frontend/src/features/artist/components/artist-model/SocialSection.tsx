import React from "react";
import { type UseFormReturn } from "react-hook-form";
import {
  Facebook,
  Globe,
  Instagram,
  Music2,
  Twitter,
  Youtube,
  Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ArtistFormValues } from "@/features/artist/schemas/artist.schema";
import { cn } from "@/lib/utils";

interface SocialSectionProps {
  form: UseFormReturn<ArtistFormValues>;
}

const SocialSection: React.FC<SocialSectionProps> = ({ form }) => {
  const {
    register,
    formState: { errors },
  } = form;

  const socialFields = [
    {
      name: "facebook",
      icon: <Facebook className="size-4 text-[#1877F2]" />,
      placeholder: "facebook.com/...",
      label: "Facebook",
    },
    {
      name: "instagram",
      icon: <Instagram className="size-4 text-[#E4405F]" />,
      placeholder: "instagram.com/...",
      label: "Instagram",
    },
    {
      name: "twitter",
      icon: <Twitter className="size-4 text-[#1DA1F2]" />,
      placeholder: "twitter.com/...",
      label: "Twitter (X)",
    },
    {
      name: "spotify",
      icon: <Music2 className="size-4 text-[#1DB954]" />,
      placeholder: "open.spotify.com/artist/...",
      label: "Spotify",
    },
    {
      name: "youtube",
      icon: <Youtube className="size-4 text-[#FF0000]" />,
      placeholder: "youtube.com/channel/...",
      label: "YouTube",
    },
    {
      name: "website",
      icon: <Globe className="size-4 text-foreground/70" />,
      placeholder: "https://your-website.com",
      label: "Website",
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header Section */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <Link2 className="size-4 text-primary" />
        <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">
          Liên kết Mạng xã hội
        </h4>
      </div>

      {/* Grid Inputs */}
      <div className="grid gap-4">
        {socialFields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <div className="relative group">
              {/* Icon Container */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 transition-transform group-focus-within:scale-110">
                {field.icon}
              </div>

              {/* Input Field — flat field names (facebook, instagram, etc.) */}
              <Input
                {...register(field.name as keyof ArtistFormValues)}
                placeholder={field.placeholder}
                className={cn(
                  "pl-10 h-10 text-sm bg-background border-input shadow-sm transition-all",
                  "focus-visible:ring-2 focus-visible:ring-primary/20",
                  "placeholder:text-muted-foreground/60",
                  errors[field.name as keyof ArtistFormValues] &&
                    "border-destructive focus-visible:ring-destructive/20 bg-destructive/5",
                )}
              />
            </div>

            {/* Error Message */}
            {errors[field.name as keyof ArtistFormValues] && (
              <p className="text-[11px] font-bold text-destructive ml-1 animate-in slide-in-from-left-1">
                {(errors[field.name as keyof ArtistFormValues] as any)?.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SocialSection;
