import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Headphones, FileText, Image, Star, Trophy, RotateCcw, Zap, Lock, ChevronRight } from "lucide-react";
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
  trackName: string;
  artistName: string;
  albumArt: string | null;
  personalClue: string;
  maskedLyricIndex: number;
  playCount: number;
  playsRemaining: number;
  userPoints: number;
}

interface MediaData {
  lyrics: string[];
  audioPreviewUrl: string | null;
  albumArt: string | null;
}

type GamePhase = "loading" | "error" | "gated" | "playing" | "won" | "lost";

const STAGE_META = [
  { icon: FileText, label: "Personal Clue", color: "text-blue-400" },
  { icon: FileText, label: "Hidden Lyric", color: "text-purple-400" },
  { icon: Image, label: "Album Art", color: "text-emerald-400" },
  { icon: Headphones, label: "Audio Snippet", color: "text-primary" },
];

const MAX_GUESSES = 4;

// ─── Guess checking ───────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*[\(\[].+?[\)\]]\s*/g, "")
    .replace(/\bfeat\.?\s+.+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectGuess(guess: string, trackName: string, artistName: string): boolean {
  const g = norm(guess);
  if (g.length < 2) return false;
  const t = norm(trackName);
  const a = norm(artistName);
  // Accept if guess substantially matches track title OR artist name
  return (
    t === g ||
    a === g ||
    (g.length >= 3 && t.startsWith(g)) ||
    (g.length >= 3 && a.startsWith(g)) ||
    (g.length >= 4 && t.includes(g)) ||
    (g.length >= 4 && a.includes(g))
  );
}

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
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
  const [lastWrong, setLastWrong] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Load puzzle + media in parallel on mount
  useEffect(() => {
    if (!puzzleId) {
      setPhase("error");
      return;
    }

    setPhase("loading");
    setMediaLoading(true);

    Promise.all([
      fetch(apiUrl(`/puzzles/${puzzleId}`)).then((r) => r.json() as Promise<PuzzleData & { error?: string }>),
      fetch(apiUrl(`/puzzles/${puzzleId}/media`)).then((r) => r.json() as Promise<MediaData & { error?: string }>),
    ])
      .then(([puzzleData, mediaData]) => {
        if (puzzleData.error) {
          setPhase("error");
          return;
        }
        setPuzzle(puzzleData);
        if (!mediaData.error) setMedia(mediaData);
        setPhase(puzzleData.playsRemaining === 0 ? "gated" : "playing");
      })
      .catch(() => setPhase("error"))
      .finally(() => setMediaLoading(false));
  }, [puzzleId]);

  const handleGuess = useCallback(
    async (artist: string, title: string) => {
      if (!puzzle || phase !== "playing") return;

      const guessText = `${artist} — ${title}`;
      const correct = isCorrectGuess(artist, puzzle.artistName, puzzle.trackName) ||
        isCorrectGuess(title, puzzle.trackName, puzzle.artistName);

      const newGuesses = [...guesses, guessText];
      setGuesses(newGuesses);

      if (correct) {
        setPhase("won");
        await recordPlay(true, stage + 1);
        return;
      }

      setLastWrong(true);
      setTimeout(() => setLastWrong(false), 600);

      if (newGuesses.length >= MAX_GUESSES) {
        setPhase("lost");
        await recordPlay(false, MAX_GUESSES);
        return;
      }

      // Advance to next stage
      if (stage < MAX_GUESSES - 1) {
        setStage(stage + 1);
      }
    },
    [puzzle, phase, guesses, stage],
  );

  async function recordPlay(won: boolean, stagesUsed: number) {
    if (!puzzle) return;
    setSubmitting(true);
    try {
      await fetch(apiUrl(`/puzzles/${puzzle.id}/play`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ won, stagesUsed }),
      });
    } catch {
      // Non-blocking — don't show error for stat recording failures
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlock() {
    if (!puzzle || !user) {
      setLocation("/sign-in");
      return;
    }
    if ((puzzle.userPoints ?? 0) < 50) {
      toast({ title: "Not enough points", description: "You need 50 points to unlock a play.", variant: "destructive" });
      return;
    }

    setUnlocking(true);
    try {
      const res = await fetch(apiUrl(`/puzzles/${puzzle.id}/play`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ won: false, stagesUsed: 0, unlock: true }),
      });
      if (res.ok) {
        setPuzzle((p) => p ? { ...p, playsRemaining: 1, userPoints: (p.userPoints ?? 0) - 50 } : p);
        setPhase("playing");
        setStage(0);
        setGuesses([]);
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

  if (phase === "gated") {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl font-black">Daily limit reached</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Free players get <strong>3 puzzle plays per day</strong>. Come back tomorrow, or spend <strong>50 points</strong> to unlock one more play right now.
          </p>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Your points</span>
              <span className="font-bold text-primary flex items-center gap-1">
                <Star className="w-3.5 h-3.5" />
                {puzzle.userPoints ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Unlock cost</span>
              <span className="font-medium">50 points</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {user ? (
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
            ) : (
              <Button className="gap-2 h-12" onClick={() => setLocation("/sign-in")}>
                Sign in to use your points
              </Button>
            )}
            <Button variant="outline" onClick={() => setLocation("/")}>Back to home</Button>
          </div>
        </div>
      </>
    );
  }

  if (phase === "won" || phase === "lost") {
    const stagesUsed = guesses.length;
    const pointsEarned = phase === "won" ? 20 + 5 * Math.max(0, stagesUsed - 1) : 0;

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
            {(media?.albumArt || puzzle.albumArt) ? (
              <img
                src={media?.albumArt ?? puzzle.albumArt ?? ""}
                alt=""
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Music2 className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-foreground truncate text-lg">{puzzle.trackName}</div>
              <div className="text-sm text-muted-foreground truncate">{puzzle.artistName}</div>
            </div>
          </div>

          {/* Personal clue reminder */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground italic">
            "{puzzle.personalClue}"
          </div>

          {/* Guesses */}
          {guesses.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your guesses</p>
              {guesses.map((g, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  i === guesses.length - 1 && phase === "won"
                    ? "bg-primary/15 text-primary font-medium"
                    : "bg-card text-muted-foreground line-through opacity-60"
                }`}>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}

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

        {/* Stage indicator */}
        <div className="flex items-center gap-1">
          {STAGE_META.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex flex-col items-center ${i === stage ? "opacity-100" : i < stage ? "opacity-60" : "opacity-25"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i < stage ? "bg-primary/20" : i === stage ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
                    }`}
                  >
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

        {/* Guesses used */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{MAX_GUESSES - guesses.length} guess{MAX_GUESSES - guesses.length !== 1 ? "es" : ""} remaining</span>
          <div className="flex gap-1">
            {Array.from({ length: MAX_GUESSES }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < guesses.length ? "bg-destructive/70" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        {/* Stage content */}
        <AnimatePresence mode="wait">
          <motion.div key={stage} {...fadeUp} className="space-y-4">

            {/* Stage 0 – Personal Clue */}
            {stage >= 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Creator's clue
                </p>
                <p className="text-lg text-foreground italic leading-relaxed">"{puzzle.personalClue}"</p>
              </div>
            )}

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
          <GuessInput onGuess={handleGuess} disabled={phase !== "playing"} />
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          Guess the <strong>song title</strong> or <strong>artist name</strong>
        </p>
      </div>
    </>
  );
}
