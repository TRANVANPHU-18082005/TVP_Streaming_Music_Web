import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/60 bg-card text-card-foreground pt-16 pb-8 mt-auto z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {/* --- TOP GRID SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-16">
          {/* 1. BRAND COLUMN (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <Link
              to="/"
              className="flex items-center gap-3 group w-fit focus-visible:outline-none"
            >
              <div className="relative flex items-center justify-center size-12 rounded-xl bg-primary/10 border border-primary/20 shadow-sm transition-transform group-hover:scale-105">
                <Avatar className="size-full rounded-xl">
                  <AvatarImage
                    src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
                    alt="Logo"
                    className="object-cover p-1.5"
                  />
                  <AvatarFallback className="bg-transparent font-bold text-primary">
                    TVP
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>

            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              The ultimate platform for music lovers. Stream high-quality audio,
              discover new artists, and connect with a global community of
              enthusiasts.
            </p>

            <div className="flex items-center gap-2">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all duration-300"
                  aria-label="Social Link"
                >
                  <Icon className="size-5" />
                </Button>
              ))}
            </div>
          </div>

          {/* 2. LINKS COLUMNS (2 + 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <h4 className="font-bold text-base text-foreground tracking-wide">
              Discover
            </h4>
            <ul className="space-y-3.5 text-sm text-muted-foreground">
              {[
                "New Releases",
                "Top Charts",
                "Genres",
                "Radio",
                "Podcasts",
              ].map((item) => (
                <li key={item}>
                  <Link
                    to="#"
                    className="hover:text-primary hover:underline hover:underline-offset-4 transition-all duration-200 block w-fit"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h4 className="font-bold text-base text-foreground tracking-wide">
              Support
            </h4>
            <ul className="space-y-3.5 text-sm text-muted-foreground">
              {[
                "Help Center",
                "Contact Us",
                "Privacy Policy",
                "Terms of Service",
                "Community Guidelines",
              ].map((item) => (
                <li key={item}>
                  <Link
                    to="#"
                    className="hover:text-primary hover:underline hover:underline-offset-4 transition-all duration-200 block w-fit"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. NEWSLETTER COLUMN (4 cols) */}
          <div className="lg:col-span-4 space-y-6 bg-muted/30 p-6 rounded-2xl border border-border/50">
            <div>
              <h4 className="font-bold text-base text-foreground mb-2">
                Stay Updated
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Join our newsletter to get the latest updates, exclusive
                releases, and special offers.
              </p>
            </div>

            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 bg-background border-input focus-visible:ring-primary h-11 rounded-xl transition-all"
                  aria-label="Email Address"
                />
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl shadow-md shadow-primary/20 hover:scale-105 transition-transform"
                  type="submit"
                >
                  <ArrowRight className="size-5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                By subscribing, you agree to our Privacy Policy. No spam, ever.
              </p>
            </form>
          </div>
        </div>

        {/* --- BOTTOM BAR --- */}
        <div className="border-t border-border/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="font-medium">
            © {new Date().getFullYear()} MusicHub Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-6 sm:gap-8 font-medium">
            <Link to="#" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="#" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="#" className="hover:text-foreground transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
