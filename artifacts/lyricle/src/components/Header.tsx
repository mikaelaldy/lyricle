import { useUser, useClerk } from "@clerk/react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, LogOut, LogIn, PlusCircle } from "lucide-react";

export default function Header() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <img src="/logo.svg" alt="Lyricle Logo" className="w-8 h-8 group-hover:rotate-12 transition-transform" />
          <span className="font-serif text-2xl font-black tracking-tight text-primary">LYRICLE</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/leaderboard">
            <Button variant="ghost" size="icon" title="Leaderboard" data-testid="button-leaderboard">
              <Trophy className="w-5 h-5" />
            </Button>
          </Link>

          {isLoaded && user && (
            <Link href="/create">
              <Button variant="ghost" size="icon" title="Create Puzzle" data-testid="button-create">
                <PlusCircle className="w-5 h-5" />
              </Button>
            </Link>
          )}

          {isLoaded && (
            <>
              {user ? (
                <div className="flex items-center gap-3 ml-2">
                  <span className="hidden sm:inline text-sm font-medium text-muted-foreground">
                    {user.firstName || user.emailAddresses[0].emailAddress.split("@")[0]}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleSignOut} 
                    title="Sign Out"
                    data-testid="button-signout"
                  >
                    <LogOut className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation("/sign-in")} 
                  title="Sign In"
                  data-testid="button-signin"
                >
                  <LogIn className="w-5 h-5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
