import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Trophy, BarChart2, Music2, MapPin, Calendar, Radio } from "lucide-react";
import { useGetPuzzleAnswer, useGetPlayerStreak } from "@workspace/api-client-react";
import { getGetPuzzleAnswerQueryKey, getGetPlayerStreakQueryKey } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { DailyState } from "@/lib/storage";

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

interface ResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DailyState;
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

function formatStreams(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function ResultModal({ open, onOpenChange, state, onOpenStats, onOpenLeaderboard }: ResultModalProps) {
  const { data: answer } = useGetPuzzleAnswer({ query: { enabled: open, queryKey: getGetPuzzleAnswerQueryKey() } });
  const { data: streak } = useGetPlayerStreak(
    localStorage.getItem("lyricle_player")
      ? JSON.parse(localStorage.getItem("lyricle_player")!).playerId
      : "",
    {
      query: {
        enabled: open,
        queryKey: getGetPlayerStreakQueryKey(
          localStorage.getItem("lyricle_player")
            ? JSON.parse(localStorage.getItem("lyricle_player")!).playerId
            : "",
        ),
      },
    },
  );

  const [timeLeft, setTimeLeft] = useState("");
  const [concerts, setConcerts] = useState<ConcertResult[] | null>(null);
  const [concertsLoading, setConcertsLoading] = useState(false);
  const [streams, setStreams] = useState<number | null | undefined>(undefined);
  const [streamsLoading, setStreamsLoading] = useState(false);

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

  // Fetch partner data once we have the answer and the modal is open
  useEffect(() => {
    if (!open || !answer?.artist) return;

    // Concerts
    setConcertsLoading(true);
    fetch(apiUrl(`/artist/concerts?artist=${encodeURIComponent(answer.artist)}`))
      .then((r) => r.json() as Promise<{ concerts: ConcertResult[] }>)
      .then((d) => setConcerts(d.concerts ?? []))
      .catch(() => setConcerts([]))
      .finally(() => setConcertsLoading(false));

    // Stream stats
    if (answer.title) {
      setStreamsLoading(true);
      fetch(apiUrl(`/track/stats?artist=${encodeURIComponent(answer.artist)}&title=${encodeURIComponent(answer.title)}`))
        .then((r) => r.json() as Promise<{ streams: number | null }>)
        .then((d) => setStreams(d.streams))
        .catch(() => setStreams(null))
        .finally(() => setStreamsLoading(false));
    }
  }, [open, answer?.artist, answer?.title]);

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
      ? `🎵 Lyricle #${state.puzzleNumber} — Got it in ${state.guesses.length}/5`
      : `🎵 Lyricle #${state.puzzleNumber} — Didn't get it`;
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

  const showConcerts = concertsLoading || (concerts !== null && concerts.length > 0);
  const showStreams = streamsLoading || streams != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-serif text-center mb-2">
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
              <img src={answer.albumArtUrl || ""} alt={answer.title} className="w-full h-full object-cover" />
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

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/50">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold">{streak?.currentStreak || 0}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Current Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-primary">{timeLeft}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Next Puzzle</div>
          </div>
        </div>

        {/* Partner section: only renders when there's something to show */}
        {(showStreams || showConcerts) && (
          <div className="space-y-3 pt-1">

            {/* Songstats: "Did you know?" */}
            {showStreams && (
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Did you know?</span>
                </div>
                {streamsLoading ? (
                  <div className="h-5 w-48 bg-muted/50 rounded animate-pulse" />
                ) : streams != null ? (
                  <p className="text-sm text-foreground">
                    <span className="font-bold text-primary">{formatStreams(streams)}</span> Spotify streams
                    {answer?.title ? ` for "${answer.title}"` : ""}
                  </p>
                ) : null}
              </div>
            )}

            {/* JamBase: "Catch them live" */}
            {showConcerts && (
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
                ) : null}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
          <Button onClick={handleShare} className="flex-1 gap-2 font-bold" data-testid="button-share">
            <Share2 className="w-4 h-4" /> Share
          </Button>
          <Button variant="outline" onClick={onOpenLeaderboard} className="flex-1 gap-2" data-testid="button-results-leaderboard">
            <Trophy className="w-4 h-4" /> Leaderboard
          </Button>
          <Button variant="outline" onClick={onOpenStats} className="flex-1 gap-2" data-testid="button-results-stats">
            <BarChart2 className="w-4 h-4" /> Stats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
