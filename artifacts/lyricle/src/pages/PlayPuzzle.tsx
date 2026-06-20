import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Headphones, FileText, Image, Trophy, RotateCcw, Zap, Lock, ChevronRight, LogIn, BarChart2, MapPin, Calendar, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import AudioPlayer from "@/components/AudioPlayer";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PuzzleData {
  id: string;
  trackId: string;
  albumArt: string | null;
  personalClue: string;
  maskedLyricIndex: number;
  playCount: number;
  playsRemaining: number;
  userPoints: number;
  requiresAuth: boolean;
}

interface MediaData {
  lyrics: string[];
  audioPreviewUrl: string | null;
  albumArt: string | null;
}

interface FinalReveal {
  trackName: string;
  artistName: string;
  albumArt: string | null;
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

type GamePhase = "loading" | "error" | "auth-gate" | "play-gate" | "playing" | "won" | "lost";

const STAGE_META = [
  { icon: FileText, label: "Personal Clue" },
  { icon: FileText, label: "Hidden Lyric" },
  { icon: Image,    label: "Album Art"    },
  { icon: Headphones, label: "Audio Snippet" },
];

const MAX_GUESSES = 4;

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  params?: { id?: string };
}

export default function PlayPuzzle({ params }: Props) {
  const puzzleId = params?.id ?? "";
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [phase, setPhase] = useState<GamePhase>("loading");
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [media, setMedia] = useState<MediaData | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [answer, setAnswer] = useState<FinalReveal | null>(null);
  const [lastWrong, setLastWrong] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Trivia & Concert states
  const [concerts, setConcerts] = useState<ConcertResult[] | null>(null);
  const [concertsLoading, setConcertsLoading] = useState(false);
  const [facts, setFacts] = useState<TrackFact[] | null>(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [knowMore, setKnowMore] = useState(false);

  // Load puzzle on mount; load media separately once we know auth status.
  useEffect(() => {
    if (!puzzleId) { setPhase("error"); return; }

    setPhase("loading");

    fetch(apiUrl(`/puzzles/${puzzleId}`))
      .then((r) => r.json() as Promise<PuzzleData & { error?: string }>)
      .then((data) => {
        if (data.error) { setPhase("error"); return; }
        setPuzzle(data);

        if (data.requiresAuth) {
          setPhase("auth-gate");
          return;
        }
        if (data.playsRemaining === 0) {
          setPhase("play-gate");
          return;
        }

        setPhase("playing");
        // Fetch media in background once we know the user can play.
        setMediaLoading(true);
        fetch(apiUrl(`/puzzles/${puzzleId}/media`))
          .then((r) => r.json() as Promise<MediaData & { error?: string }>)
          .then((m) => { if (!m.error) setMedia(m); })
          .catch(() => {/* media is optional — degrade gracefully */})
          .finally(() => setMediaLoading(false));
      })
      .catch(() => setPhase("error"));
  }, [puzzleId]);

  // Fetch trivia/concerts when "Get to know" is clicked
  useEffect(() => {
    if ((phase !== "won" && phase !== "lost") || !knowMore || !answer?.artistName) return;

    if (concerts === null && !concertsLoading) {
      setConcertsLoading(true);
      fetch(apiUrl(`/artist/concerts?artist=${encodeURIComponent(answer.artistName)}`))
        .then((r) => r.json() as Promise<{ concerts: ConcertResult[] }>)
        .then((d) => setConcerts(d.concerts ?? []))
        .catch(() => setConcerts([]))
        .finally(() => setConcertsLoading(false));
    }

    if (answer.trackName && facts === null && !factsLoading) {
      setFactsLoading(true);
      fetch(apiUrl(`/track/stats?artist=${encodeURIComponent(answer.artistName)}&title=${encodeURIComponent(answer.trackName)}`))
        .then((r) => r.json() as Promise<{ streams: number | null; facts: TrackFact[] }>)
        .then((d) => setFacts(d.facts ?? []))
        .catch(() => setFacts([]))
        .finally(() => setFactsLoading(false));
    }
  }, [phase, knowMore, answer?.artistName, answer?.trackName]);

  const handleGuess = useCallback(
    async (artist: string, title: string) => {
      if (!puzzle || phase !== "playing" || guessing) return;

      const guessText = `${artist} — ${title}`;
      const newGuesses = [...guesses, guessText];
      const isLastGuess = newGuesses.length >= MAX_GUESSES;

      setGuessing(true);
      try {
        const res = await fetch(apiUrl(`/puzzles/${puzzle.id}/guess`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist, title }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: string };
          toast({ title: "Error", description: err.error ?? "Failed to check guess.", variant: "destructive" });
          return;
        }

        const result = await res.json() as { correct: boolean };

        setGuesses(newGuesses);

        if (result.correct || isLastGuess) {
          // Game over — record play server-side; answer comes back in /play response.
          const won = result.correct;
          const stagesUsed = Math.max(1, Math.min(4, newGuesses.length));
          const playRes = await fetch(apiUrl(`/puzzles/${puzzle.id}/play`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ won, stagesUsed }),
          });

          if (playRes.ok) {
            const playData = await playRes.json() as { finalReveal?: FinalReveal };
            if (playData.finalReveal) setAnswer(playData.finalReveal);
          }

          setPhase(won ? "won" : "lost");
          window.dispatchEvent(new Event("lyricle:points-updated"));
          return;
        }

        // Wrong guess, game continues — shake and advance to next stage.
        setLastWrong(true);
        setTimeout(() => setLastWrong(false), 600);
        if (stage < MAX_GUESSES - 1) setStage(stage + 1);
      } catch {
        toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
      } finally {
        setGuessing(false);
      }
    },
    [puzzle, phase, guesses, stage, guessing],
  );

  async function handleUnlock() {
    if (!puzzle) return;
    if (!user) { setLocation("/sign-in"); return; }

    if ((puzzle.userPoints ?? 0) < 50) {
      toast({ title: "Not enough points", description: "You need 50 points to unlock a play.", variant: "destructive" });
      return;
    }

    setUnlocking(true);
    try {
      const res = await fetch(apiUrl(`/puzzles/${puzzle.id}/unlock`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json() as { playsRemaining: number; userPoints: number };
        setPuzzle((p) => p ? { ...p, playsRemaining: data.playsRemaining, userPoints: data.userPoints } : p);
        setPhase("playing");
        setStage(0);
        setGuesses([]);
        setAnswer(null);

        // Load media now that unlock succeeded.
        setMediaLoading(true);
        fetch(apiUrl(`/puzzles/${puzzle.id}/media`))
          .then((r) => r.json() as Promise<MediaData & { error?: string }>)
          .then((m) => { if (!m.error) setMedia(m); })
          .catch(() => {})
          .finally(() => setMediaLoading(false));
      } else {
        const err = await res.json() as { error?: string };
        toast({ title: "Unlock failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  }

  // ─── Renders ────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <>
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-4 text-muted-foreground">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading puzzle…</span>
        </div>
      </>
    );
  }

  if (phase === "error" || !puzzle) {
    return (
      <>
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-4 text-center px-4">
          <Music2 className="w-12 h-12 text-muted-foreground/40" />
          <h2 className="text-xl font-bold">Puzzle not found</h2>
          <p className="text-muted-foreground text-sm">This link may be invalid or the puzzle was removed.</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go home</Button>
        </div>
      </>
    );
  }

  // User not signed in at all — require sign-in before play.
  if (phase === "auth-gate") {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl font-black">Sign in to play</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Create a free account to play custom Lyricle puzzles, earn points, and see the leaderboard.
          </p>

          {/* Teaser: show only the clue, gated */}
          <div className="bg-card border border-border rounded-xl p-5 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Creator's clue
            </p>
            <p className="text-base text-foreground italic leading-relaxed">"{puzzle.personalClue}"</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button className="gap-2 h-12" onClick={() => setLocation("/sign-in")}>
              <LogIn className="w-4 h-4" /> Sign in to play
            </Button>
            <Button variant="outline" onClick={() => setLocation("/sign-up")}>
              Create a free account
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setLocation("/")}>
              Back to home
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Signed in but out of plays for today.
  if (phase === "play-gate") {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl font-black">Daily limit reached</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Free players get <strong>3 puzzle plays per day</strong>. Come back tomorrow, or spend{" "}
            <strong>50 points</strong> to unlock one more play right now.
          </p>

          <div className="bg-card border border-border rounded-xl p-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Your points</span>
              <span className="font-bold text-primary">{puzzle.userPoints ?? 0} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unlock cost</span>
              <span className="font-medium">50 pts</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="gap-2 h-12"
              disabled={unlocking || (puzzle.userPoints ?? 0) < 50}
              onClick={handleUnlock}
            >
              {unlocking ? (
                <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Unlocking…</>
              ) : (
                <><Zap className="w-4 h-4" /> Spend 50 points to play</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")}>Back to home</Button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "won" || phase === "lost") {
    const stagesUsed = guesses.length;
    const pointsEarned = phase === "won" ? 20 + 5 * Math.max(0, stagesUsed - 1) : 0;
    const revealArt = answer?.albumArt ?? media?.albumArt ?? puzzle.albumArt;

    return (
      <>
        <Header />
        <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${phase === "won" ? "bg-primary/20" : "bg-destructive/20"}`}
          >
            {phase === "won" ? (
              <Trophy className="w-10 h-10 text-primary" />
            ) : (
              <Music2 className="w-10 h-10 text-destructive" />
            )}
          </motion.div>

          <div className="text-center">
            <h2 className="font-serif text-3xl font-black mb-1">
              {phase === "won" ? "You got it!" : "Better luck next time"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {phase === "won"
                ? `Guessed in ${stagesUsed} ${stagesUsed === 1 ? "try" : "tries"} · +${pointsEarned} points`
                : "The answer was…"}
            </p>
          </div>

          {/* Song reveal */}
          <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
            {revealArt ? (
              <img src={revealArt} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Music2 className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              {answer ? (
                <>
                  <div className="font-bold text-foreground truncate text-lg">{answer.trackName}</div>
                  <div className="text-sm text-muted-foreground truncate">{answer.artistName}</div>
                </>
              ) : (
                <div className="text-muted-foreground text-sm italic">Song details unavailable</div>
              )}
            </div>
          </div>

          {/* Personal clue reminder */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground italic">
            "{puzzle.personalClue}"
          </div>

          {/* Guesses recap */}
          {guesses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your guesses</p>
              {guesses.map((g, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    i === guesses.length - 1 && phase === "won"
                      ? "bg-primary/15 text-primary font-medium"
                      : "bg-card text-muted-foreground line-through opacity-60"
                  }`}
                >
                  {g}
                </div>
              ))}
            </div>
          )}

          {/* Get to know the song / artist (expandable) */}
          <div className="pt-2 pb-2">
            <button
              onClick={() => setKnowMore((v) => !v)}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
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

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setLocation("/create")}>
              Create your own puzzle <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={() => setLocation("/")}>
              <RotateCcw className="w-4 h-4" /> Back to home
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ─── Playing phase ────────────────────────────────────────────────────────

  const lyrics = media?.lyrics ?? [];
  const maskedIdx = puzzle.maskedLyricIndex;
  const audioUrl = media?.audioPreviewUrl ?? null;
  const albumArt = media?.albumArt ?? puzzle.albumArt ?? null;

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Stage progress */}
        <div className="flex items-center gap-1">
          {STAGE_META.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={`flex flex-col items-center ${i === stage ? "opacity-100" : i < stage ? "opacity-60" : "opacity-25"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i < stage ? "bg-primary/20" : i === stage ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"}`}>
                    <Icon className={`w-4 h-4 ${i <= stage ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-[10px] mt-1 hidden sm:block font-medium ${i === stage ? "text-primary" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STAGE_META.length - 1 && (
                  <div className={`h-px flex-1 mx-1 ${i < stage ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Guesses remaining */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{MAX_GUESSES - guesses.length} guess{MAX_GUESSES - guesses.length !== 1 ? "es" : ""} remaining</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_GUESSES }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < guesses.length ? "bg-destructive/70" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        {/* Stage content panels — stacked as more are revealed */}
        <AnimatePresence mode="wait">
          <motion.div key={stage} {...fadeUp} className="space-y-4">

            {/* Stage 0 – Personal Clue (always visible once playing) */}
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Creator's clue
              </p>
              <p className="text-lg text-foreground italic leading-relaxed">"{puzzle.personalClue}"</p>
            </div>

            {/* Stage 1 – Masked Lyrics */}
            {stage >= 1 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Lyrics — one line hidden
                </p>
                {mediaLoading || lyrics.length === 0 ? (
                  <div className="text-muted-foreground text-sm italic">
                    {mediaLoading ? "Loading lyrics…" : "Lyrics unavailable for this track."}
                  </div>
                ) : (
                  <div className="space-y-0.5 font-mono text-sm leading-relaxed max-h-60 overflow-y-auto">
                    {lyrics.map((line, i) =>
                      i === maskedIdx ? (
                        <div key={i} className="px-2 py-1 bg-primary/15 border border-primary/30 rounded text-primary font-semibold">
                          [ ??? ]
                        </div>
                      ) : (
                        <div key={i} className="px-2 py-0.5 text-muted-foreground">{line}</div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stage 2 – Album Art */}
            {stage >= 2 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> Album art
                </p>
                {albumArt ? (
                  <img src={albumArt} alt="Album art" className="w-40 h-40 rounded-xl object-cover mx-auto shadow-lg" />
                ) : (
                  <div className="w-40 h-40 rounded-xl bg-muted flex items-center justify-center mx-auto">
                    <Music2 className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            )}

            {/* Stage 3 – Audio Snippet */}
            {stage >= 3 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" /> 30-second preview
                </p>
                {audioUrl ? (
                  <AudioPlayer src={audioUrl} />
                ) : (
                  <div className="flex items-center gap-2 justify-center p-4 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                    <Headphones className="w-4 h-4 opacity-50" />
                    Preview not available for this track
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Previous wrong guesses */}
        {guesses.length > 0 && (
          <div className="space-y-1">
            {guesses.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-muted-foreground line-through opacity-70">
                {g}
              </div>
            ))}
          </div>
        )}

        {/* Guess input */}
        <motion.div
          animate={lastWrong ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
        >
          <GuessInput onGuess={handleGuess} disabled={phase !== "playing" || guessing} />
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          Guess the <strong>song title</strong> or <strong>artist name</strong>
        </p>
      </div>
    </>
  );
}
