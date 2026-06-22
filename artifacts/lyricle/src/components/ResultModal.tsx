import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Trophy,
  BarChart2,
  Music2,
  MapPin,
  Calendar,
  Sparkles,
  ChevronDown,
  Coins,
  Timer,
  Send,
  Loader2,
  CheckCircle2,
  RotateCcw,
  LogIn,
  Swords,
  Users,
} from "lucide-react";
import { useGetPuzzleAnswer, useGetPlayerStreak } from "@workspace/api-client-react";
import { getGetPuzzleAnswerQueryKey, getGetPlayerStreakQueryKey } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { DailyState, getPlayerData } from "@/lib/storage";
import CountryPicker from "@/components/CountryPicker";
import { flagEmoji, countryName } from "@/lib/countries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

interface ConcertResult {
  venueName: string;
  city: string;
  date: string;
  url: string | null;
}

interface TrackFact {
  source: string;
  label: string;
  value: number;
}

interface ResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DailyState;
  isLoggedIn: boolean;
  submitting: boolean;
  onSubmitScore: (country: string | null) => Promise<{ saved: boolean }>;
  onRetry: () => void;
  onSignIn: () => void;
  onOpenStats: () => void;
  onOpenLeaderboard: () => void;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatTime(ms: number | null | undefined): string {
  if (ms == null) return "-";
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ResultModal({
  open,
  onOpenChange,
  state,
  isLoggedIn,
  submitting,
  onSubmitScore,
  onRetry,
  onSignIn,
  onOpenStats,
  onOpenLeaderboard,
}: ResultModalProps) {
  const { data: answer } = useGetPuzzleAnswer({ query: { enabled: open, queryKey: getGetPuzzleAnswerQueryKey() } });
  function getSavedPlayerId(): string {
    try {
      const raw = localStorage.getItem("lyricle_player");
      return raw ? JSON.parse(raw).playerId ?? "" : "";
    } catch {
      return "";
    }
  }

  const savedPlayerId = getSavedPlayerId();
  const { data: streak } = useGetPlayerStreak(
    savedPlayerId,
    {
      query: {
        enabled: open,
        queryKey: getGetPlayerStreakQueryKey(savedPlayerId),
      },
    },
  );

  const [timeLeft, setTimeLeft] = useState("");
  const [concerts, setConcerts] = useState<ConcertResult[] | null>(null);
  const [concertsLoading, setConcertsLoading] = useState(false);
  const [facts, setFacts] = useState<TrackFact[] | null>(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [knowMore, setKnowMore] = useState(false);
  const [country, setCountry] = useState<string | null>(null);

  const submitted = state.resultSubmitted;
  const canRetry = !submitted && !state.retryUsed && isLoggedIn;

  // Seed country from saved state / player profile when the modal opens
  useEffect(() => {
    if (!open) return;
    const fromState = state.country ?? getPlayerData().country ?? null;
    setCountry(fromState);
  }, [open, state.country]);

  // Notify Header to refresh points when modal opens (game just ended)
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new Event("lyricle:points-updated"));
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!open) return;
    const updateTimer = () => {
      const now = new Date();
      const next = new Date();
      next.setUTCHours(24, 0, 0, 0);
      const diff = next.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Fetch partner data once the "Get to know" section is expanded
  useEffect(() => {
    if (!open || !knowMore || !answer?.artist) return;

    if (concerts === null && !concertsLoading) {
      setConcertsLoading(true);
      fetch(apiUrl(`/artist/concerts?artist=${encodeURIComponent(answer.artist)}`))
        .then((r) => r.json() as Promise<{ concerts: ConcertResult[] }>)
        .then((d) => setConcerts(d.concerts ?? []))
        .catch(() => setConcerts([]))
        .finally(() => setConcertsLoading(false));
    }

    if (answer.title && facts === null && !factsLoading) {
      setFactsLoading(true);
      fetch(apiUrl(`/track/stats?artist=${encodeURIComponent(answer.artist)}&title=${encodeURIComponent(answer.title)}`))
        .then((r) => r.json() as Promise<{ streams: number | null; facts: TrackFact[] }>)
        .then((d) => setFacts(d.facts ?? []))
        .catch(() => setFacts([]))
        .finally(() => setFactsLoading(false));
    }
  }, [open, knowMore, answer?.artist, answer?.title]);

  const buildEmojiGrid = () => {
    return (
      state.guesses.map((g) => (g.correct ? "🟢" : "🟡")).join("") +
      Array(5 - state.guesses.length)
        .fill("⬜")
        .join("")
    );
  };

  const buildShareText = () => {
    const grid = buildEmojiGrid();
    const resultLine = state.won
      ? `🎵 Lyricle #${state.puzzleNumber} - Got it in ${state.guesses.length}/5 (${formatTime(state.solveTimeMs)})`
      : `🎵 Lyricle #${state.puzzleNumber} - Didn't get it`;
    return `${resultLine}\n${grid}\n${window.location.origin}`;
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!", description: "Share your result with friends." });
    } catch {
      toast({ title: "Could not copy", description: "Please copy the result manually.", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    try {
      const result = await onSubmitScore(country);
      if (result?.saved) {
        toast({ title: "Score submitted!", description: "You're on the leaderboard." });
      } else {
        toast({ title: "Sign in to save your score", description: "Create a free account to track your streak and points.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-serif text-center mb-2 text-balance">
            {state.won ? "Brilliant!" : "Next time..."}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {state.won
              ? `You guessed the song in ${state.guesses.length} attempts.`
              : "You've used all your guesses for today."}
          </DialogDescription>
        </DialogHeader>

        {answer && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-48 h-48 rounded-xl overflow-hidden shadow-2xl border border-border">
              <img src={answer.albumArtUrl || ""} alt={answer.title} width={192} height={192} className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-serif font-bold text-primary">{answer.title}</h3>
              <p className="text-lg text-muted-foreground">{answer.artist}</p>
            </div>
          </div>
        )}

        <div className="flex justify-center py-3">
          <div className="flex gap-1.5 text-3xl" data-testid="emoji-grid">
            {state.guesses.map((g, i) => (
              <span key={i}>{g.correct ? "🟢" : "🟡"}</span>
            ))}
            {Array(5 - state.guesses.length)
              .fill(null)
              .map((_, i) => (
                <span key={`empty-${i}`}>⬜</span>
              ))}
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2 py-4 border-y border-border/50">
          <div className="text-center">
            <div className="text-xl font-mono font-bold">{streak?.currentStreak || 0}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Streak</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono font-bold flex items-center justify-center gap-1">
              <Timer className="w-4 h-4 text-muted-foreground" />
              {formatTime(state.solveTimeMs)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Time</div>
          </div>
          <div className="text-center">
            {submitted ? (
              <div className="text-xl font-mono font-bold flex items-center justify-center gap-1 text-amber-500">
                <Coins className="w-4 h-4" />
                {(state.pointsEarned ?? 0).toLocaleString()}
              </div>
            ) : (
              <div className="text-xl font-mono font-bold text-primary">{timeLeft.split(":")[0]}h</div>
            )}
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {submitted ? "Points" : "Next In"}
            </div>
          </div>
        </div>

        {/* Submit / incentives */}
        {!submitted ? (
          <div className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Where are you playing from?
              </span>
              <CountryPicker value={country} onChange={setCountry} />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full gap-2 font-bold rounded-full"
              data-testid="button-submit-score"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit your score
                </>
              )}
            </Button>

            {canRetry ? (
              <Button
                variant="outline"
                onClick={onRetry}
                disabled={submitting}
                className="w-full gap-2 rounded-full"
                data-testid="button-retry"
              >
                <RotateCcw className="w-4 h-4" /> Use your extra try (1 left)
              </Button>
            ) : !isLoggedIn ? (
              <button
                onClick={onSignIn}
                className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
                data-testid="button-signin-incentive"
              >
                <LogIn className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm">
                  <span className="font-bold text-primary">Sign in</span>
                  <span className="text-muted-foreground"> for 1 extra try and to save your streak, points &amp; progress.</span>
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-sm font-medium text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Score submitted{country ? ` from ${flagEmoji(country)} ${countryName(country) ?? ""}` : ""}!
          </div>
        )}

        {/* Get to know the song / artist (expandable) */}
        <div className="pt-3">
          <button
            onClick={() => setKnowMore((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
            data-testid="button-know-more"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Get to know the song &amp; artist</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${knowMore ? "rotate-180" : ""}`} />
          </button>

          {knowMore && (
            <div className="space-y-3 pt-3">
              {/* Cross-platform facts */}
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By the numbers</span>
                </div>
                {factsLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : facts && facts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {facts.map((f, i) => (
                      <div key={i} className="rounded-lg bg-background/60 border border-border/60 p-2.5">
                        <div className="text-lg font-mono tabular-nums font-bold text-primary leading-tight">{formatNumber(f.value)}</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{f.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No stats available for this track yet.</p>
                )}
              </div>

              {/* JamBase: "Catch them live" */}
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catch them live</span>
                </div>
                {concertsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${70 + i * 8}%` }} />
                    ))}
                  </div>
                ) : concerts && concerts.length > 0 ? (
                  <div className="space-y-3">
                    {concerts.map((c, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.venueName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {c.city}
                            </span>
                            {c.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {formatDate(c.date)}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
                          >
                            Tickets →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming shows found.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Primary post-game CTAs */}
        <div className="flex flex-col gap-2 pt-4">
          <Button
            onClick={onOpenLeaderboard}
            className="w-full gap-2 font-bold rounded-full h-11 bg-primary hover:bg-primary/90 text-white"
            data-testid="button-results-leaderboard"
          >
            <Trophy className="w-4 h-4" /> See the leaderboard
          </Button>
          <Button
            variant="outline"
            onClick={() => { window.location.href = `${basePath}/create`; }}
            className="w-full gap-2 font-bold rounded-full h-11 border-2"
            data-testid="button-challenge-friend"
          >
            <Users className="w-4 h-4" /> Challenge a friend
          </Button>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50 mt-2">
          <Button
            onClick={async () => {
              try {
                const res = await fetch(apiUrl("/duels"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    puzzleType: "daily",
                    puzzleRef: state.date,
                    wager: 50,
                    cluesUsed: state.guesses.length,
                    solveTimeMs: state.solveTimeMs,
                    won: state.won,
                    displayName: getPlayerData().displayName || "Anonymous",
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  toast({
                    title: "Duel created!",
                    description: "Your challenge was posted. Opponents can accept it in the Arena.",
                  });
                  onOpenChange(false);
                } else {
                  toast({
                    title: "Duel creation failed",
                    description: data.error || "Please try again.",
                    variant: "destructive",
                  });
                }
              } catch {
                toast({
                  title: "Network error",
                  description: "Please check your connection.",
                  variant: "destructive",
                });
              }
            }}
            variant="ghost"
            className="flex-1 gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Swords className="w-3.5 h-3.5" /> Create Duel
          </Button>
          <Button variant="ghost" onClick={handleShare} className="flex-1 gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid="button-share">
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          <Button variant="ghost" onClick={onOpenStats} className="flex-1 gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid="button-results-stats">
            <BarChart2 className="w-3.5 h-3.5" /> Stats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
