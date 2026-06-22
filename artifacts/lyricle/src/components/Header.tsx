import { useClerk } from "@clerk/react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn, Coins, WifiOff, Menu, Gamepad2, Swords, TrendingUp, PlusCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useClerkAvailability } from "@/context/ClerkAvailabilityContext";
import { useAuthUser } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link href={href}>
      <span
        className={`relative px-4 py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 select-none cursor-pointer flex items-center justify-center border ${
          isActive
            ? "text-primary bg-primary/10 border-primary/20 shadow-xs"
            : "text-slate-600 hover:text-slate-900 bg-transparent hover:bg-slate-100/50 border-transparent hover:border-slate-200/50"
        }`}
      >
        {children}
      </span>
    </Link>
  );
}

interface UnifiedHeaderLayoutProps {
  clerkAvailable: boolean;
  user: any;
  isLoaded: boolean;
  points: number | null;
  signOut: (() => Promise<void>) | null;
  signIn: () => void;
}

function UnifiedHeaderLayout({
  clerkAvailable,
  user,
  isLoaded,
  points,
  signOut,
  signIn,
}: UnifiedHeaderLayoutProps) {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 px-4 w-full pt-4 pb-3">
      <header
        className={`mx-auto max-w-4xl rounded-full border border-slate-200/40 bg-white/70 backdrop-blur-md transition-all duration-300 ${
          isScrolled
            ? "py-2 px-4 shadow-md bg-white/85"
            : "py-3.5 px-6 shadow-sm bg-white/70"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Logo capsule */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0 bg-slate-100/70 hover:bg-slate-100/90 border border-slate-200/40 px-3 py-1.5 rounded-full transition-all duration-200 shadow-xs">
            <img
              src={`${basePath}/logo.svg`}
              alt="Lyricle Logo"
              className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300"
            />
            <span className="font-serif text-base sm:text-lg font-black tracking-tight text-primary">
              LYRICLE
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <NavLink href="/game">Play</NavLink>
            {clerkAvailable && isLoaded && user && (
              <NavLink href="/lobby">Arena</NavLink>
            )}
            <NavLink href="/leaderboard">Leaderboard</NavLink>
            {clerkAvailable && isLoaded && user && (
              <NavLink href="/create">Create</NavLink>
            )}
          </nav>

          {/* Actions / Buttons Area */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {clerkAvailable && isLoaded && user && points !== null && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 text-xs font-bold shadow-sm shadow-amber-500/30 ring-1 ring-amber-600/30"
                title="Your points"
                data-testid="points-badge"
              >
                <Coins className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{points.toLocaleString()}</span>
              </div>
            )}

            {/* Desktop only Auth Actions */}
            <div className="hidden md:flex items-center gap-2">
              {clerkAvailable ? (
                isLoaded && (
                  user ? (
                    <div className="flex items-center gap-2 ml-1">
                      <span className="text-xs font-medium text-slate-600">
                        {user.firstName || user.emailAddresses[0].emailAddress.split("@")[0]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 hover:bg-slate-100 rounded-full"
                        onClick={signOut || undefined}
                        title="Sign Out"
                        aria-label="Sign Out"
                        data-testid="button-signout"
                      >
                        <LogOut className="w-4 h-4 text-slate-500" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 hover:bg-slate-100 rounded-full"
                      onClick={signIn}
                      title="Sign In"
                      aria-label="Sign In"
                      data-testid="button-signin"
                    >
                      <LogIn className="w-4 h-4" />
                    </Button>
                  )
                )
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium"
                  title="Sign-in is temporarily unavailable"
                  data-testid="signin-unavailable"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Sign in unavailable</span>
                </div>
              )}
            </div>

            {/* Mobile Sheet Trigger Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9 rounded-full border border-slate-200/50 bg-white/50 hover:bg-slate-100"
                    aria-label="Open Menu"
                  >
                    <Menu className="w-5 h-5 text-slate-700" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="flex flex-col h-full bg-white/95 backdrop-blur-md border-l border-slate-200/50 p-6 w-[280px]">
                  <SheetHeader className="text-left border-b border-slate-100 pb-4 mb-4">
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <div className="flex items-center gap-2 bg-slate-100/70 border border-slate-200/40 px-3 py-1.5 rounded-full w-fit">
                      <img src={`${basePath}/logo.svg`} alt="Lyricle Logo" className="w-5 h-5" />
                      <span className="font-serif text-base font-black tracking-tight text-primary">LYRICLE</span>
                    </div>
                  </SheetHeader>

                  {/* Navigation list */}
                  <nav className="flex flex-col gap-2">
                    <SheetClose asChild>
                      <Link href="/game" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${location === "/game" ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"}`}>
                        <Gamepad2 className="w-5 h-5" />
                        <span>Play</span>
                      </Link>
                    </SheetClose>

                    {clerkAvailable && isLoaded && user && (
                      <SheetClose asChild>
                        <Link href="/lobby" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${location === "/lobby" ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"}`}>
                          <Swords className="w-5 h-5" />
                          <span>Arena</span>
                        </Link>
                      </SheetClose>
                    )}

                    <SheetClose asChild>
                      <Link href="/leaderboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${location === "/leaderboard" ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"}`}>
                        <TrendingUp className="w-5 h-5" />
                        <span>Leaderboard</span>
                      </Link>
                    </SheetClose>

                    {clerkAvailable && isLoaded && user && (
                      <SheetClose asChild>
                        <Link href="/create" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${location === "/create" ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"}`}>
                          <PlusCircle className="w-5 h-5" />
                          <span>Create</span>
                        </Link>
                      </SheetClose>
                    )}
                  </nav>

                  {/* User Profile / Auth actions at bottom */}
                  <div className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-3">
                    {clerkAvailable ? (
                      isLoaded && (
                        user ? (
                          <div className="flex flex-col gap-2">
                            <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-xs text-muted-foreground font-medium">Signed in as</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {user.firstName || user.emailAddresses[0].emailAddress.split("@")[0]}
                              </p>
                            </div>
                            <SheetClose asChild>
                              <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2 rounded-xl py-5 border-slate-200 text-slate-700 hover:text-destructive hover:border-destructive/20 hover:bg-destructive/5 font-semibold"
                                onClick={signOut || undefined}
                              >
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out</span>
                              </Button>
                            </SheetClose>
                          </div>
                        ) : (
                          <SheetClose asChild>
                            <Button
                              className="w-full flex items-center justify-center gap-2 rounded-xl py-5 bg-primary hover:bg-[#E64500] font-bold"
                              onClick={signIn}
                            >
                              <LogIn className="w-4 h-4" />
                              <span>Sign In</span>
                            </Button>
                          </SheetClose>
                        )
                      )
                    ) : (
                      <div
                        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted text-muted-foreground text-xs font-semibold"
                        title="Sign-in is temporarily unavailable"
                      >
                        <WifiOff className="w-4 h-4" />
                        <span>Sign in unavailable</span>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

function GuestHeader() {
  const [, setLocation] = useLocation();
  return (
    <UnifiedHeaderLayout
      clerkAvailable={false}
      user={null}
      isLoaded={true}
      points={null}
      signOut={null}
      signIn={() => setLocation("/sign-in")}
    />
  );
}

function ClerkHeader() {
  const { user, isLoaded } = useAuthUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [points, setPoints] = useState<number | null>(null);

  const fetchPoints = useCallback(async () => {
    if (!user) {
      setPoints(null);
      return;
    }
    try {
      const res = await fetch(apiUrl("/users/me/points"));
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points ?? null);
      }
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  useEffect(() => {
    const handler = () => fetchPoints();
    window.addEventListener("lyricle:points-updated", handler);
    return () => window.removeEventListener("lyricle:points-updated", handler);
  }, [fetchPoints]);

  const handleSignOut = async () => {
    await signOut();
    setPoints(null);
    setLocation("/");
  };

  return (
    <UnifiedHeaderLayout
      clerkAvailable={true}
      user={user}
      isLoaded={isLoaded}
      points={points}
      signOut={handleSignOut}
      signIn={() => setLocation("/sign-in")}
    />
  );
}

export default function Header() {
  const { clerkAvailable } = useClerkAvailability();

  if (!clerkAvailable) {
    return <GuestHeader />;
  }

  return <ClerkHeader />;
}


