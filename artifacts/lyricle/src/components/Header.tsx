import { useClerk } from "@clerk/react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn, Coins, WifiOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useClerkAvailability } from "@/context/ClerkAvailabilityContext";
import { useAuthUser } from "@/context/AuthContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

interface HeaderShellProps {
  children: React.ReactNode;
}

function HeaderShell({ children }: HeaderShellProps) {
  return (
    <header className="border-b border-border bg-white sticky top-0 z-50">
      <div className="container max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <img src={`${basePath}/logo.svg`} alt="Lyricle Logo" className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-serif text-xl sm:text-2xl font-black tracking-tight text-primary hidden sm:inline">LYRICLE</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0 justify-end flex-1">
          {children}
        </div>
      </div>
    </header>
  );
}

function GuestModeHeader() {
  const [, setLocation] = useLocation();

  return (
    <HeaderShell>
      <nav className="flex items-center gap-0.5 sm:gap-2">
        <Link href="/game">
          <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
            Play
          </Button>
        </Link>
        <Link href="/leaderboard">
          <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
            Charts
          </Button>
        </Link>
      </nav>
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-muted-foreground text-[10px] sm:text-xs font-medium flex-shrink-0"
        title="Sign-in is temporarily unavailable"
        data-testid="signin-unavailable"
      >
        <WifiOff className="w-3 h-3 sm:w-3.5 h-3.5" />
        <span className="hidden xs:inline">Sign in unavailable</span>
      </div>
    </HeaderShell>
  );
}

function AuthAwareHeader() {
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
    <HeaderShell>
      <nav className="flex items-center gap-0.5 sm:gap-2">
        <Link href="/game">
          <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
            Play
          </Button>
        </Link>
        {isLoaded && user && (
          <Link href="/lobby">
            <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
              Arena
            </Button>
          </Link>
        )}
        <Link href="/leaderboard">
          <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
            Charts
          </Button>
        </Link>
        {isLoaded && user && (
          <Link href="/create">
            <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-gray-600 hover:text-primary px-2 sm:px-3">
              Create
            </Button>
          </Link>
        )}
      </nav>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isLoaded && user && points !== null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 text-xs sm:text-sm font-bold shadow-sm shadow-amber-500/30 ring-1 ring-amber-600/30"
            title="Your points"
            data-testid="points-badge"
          >
            <Coins className="w-3.5 h-3.5 sm:w-4 h-4" />
            <span className="font-mono tabular-nums">{points.toLocaleString()}</span>
          </div>
        )}

        {isLoaded && (
          <>
            {user ? (
              <div className="flex items-center gap-1 sm:gap-2 ml-1">
                <span className="hidden md:inline text-xs sm:text-sm font-medium text-muted-foreground">
                  {user.firstName || user.emailAddresses[0].emailAddress.split("@")[0]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={handleSignOut}
                  title="Sign Out"
                  aria-label="Sign Out"
                  data-testid="button-signout"
                >
                  <LogOut className="w-4.5 h-4.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setLocation("/sign-in")}
                title="Sign In"
                aria-label="Sign In"
                data-testid="button-signin"
              >
                <LogIn className="w-4.5 h-4.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </HeaderShell>
  );
}

export default function Header() {
  const { clerkAvailable } = useClerkAvailability();

  if (!clerkAvailable) {
    return <GuestModeHeader />;
  }

  return <AuthAwareHeader />;
}
