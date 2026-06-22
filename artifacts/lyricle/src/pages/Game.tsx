import { useState, useEffect } from "react";
import { useGetTodayPuzzle, useGetPuzzleClue, useSubmitGuess, useSubmitResult, useGetPuzzleAnswer } from "@workspace/api-client-react";
import { getGetTodayPuzzleQueryKey, getGetPuzzleClueQueryKey, getSubmitGuessMutationOptions, getSubmitResultMutationOptions, getGetPuzzleAnswerQueryKey } from "@workspace/api-client-react";
import { useAuthUser } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import ClueCard from "@/components/ClueCard";
import GuessInput from "@/components/GuessInput";
import ResultModal from "@/components/ResultModal";
import StatsModal from "@/components/StatsModal";
import { getDailyState, saveDailyState, getPlayerData, savePlayerData, DailyState, hasSeenTutorial, setSeenTutorial } from "@/lib/storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, Timer } from "lucide-react";

const basePathHref = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LiveTimer({ startTimeMs, completed, frozenMs, pausedAt }: { startTimeMs: number; completed: boolean; frozenMs: number | null | undefined; pausedAt: number | null }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTimeMs);

  useEffect(() => {
    if (completed || pausedAt) {
      if (pausedAt) setElapsed(pausedAt - startTimeMs);
      return;
    }
    setElapsed(Date.now() - startTimeMs);
    const id = setInterval(() => setElapsed(Date.now() - startTimeMs), 1000);
    return () => clearInterval(id);
  }, [completed, startTimeMs, pausedAt]);

  const display = completed ? formatTime(frozenMs ?? 0) : formatTime(elapsed);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/70 border border-border font-mono text-sm font-bold tabular-nums"
      title={completed ? "Your solve time" : "Time elapsed"}
      data-testid="live-timer"
    >
      <Timer className={`w-4 h-4 ${completed ? "text-muted-foreground" : "text-primary"}`} />
      {display}
    </div>
  );
}

export default function Game() {
  const { user, isLoaded: clerkLoaded } = useAuthUser();
  const { data: puzzle, isLoading: puzzleLoading, isError: puzzleError } = useGetTodayPuzzle();
  
  const [gameState, setGameState] = useState<DailyState | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [timerPauseStart, setTimerPauseStart] = useState<number | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const submitGuess = useSubmitGuess();
  const submitResult = useSubmitResult();

  useEffect(() => {
    if (puzzle) {
      const saved = getDailyState(puzzle.puzzleNumber);
      if (saved) {
        setGameState(saved);
        if (saved.completed) setShowResult(true);
      } else {
        const initialState: DailyState = {
          puzzleNumber: puzzle.puzzleNumber,
          date: puzzle.date,
          stagesRevealed: 1,
          guesses: [],
          completed: false,
          won: false,
          startTimeMs: Date.now(),
          resultSubmitted: false,
        };
        setGameState(initialState);
        saveDailyState(puzzle.puzzleNumber, initialState);
      }
    }
  }, [puzzle]);

  useEffect(() => {
    if (!hasSeenTutorial()) {
      setShowTutorial(true);
      setTutorialStep(0);
      setTimerPauseStart(Date.now());
    }
    const player = getPlayerData();
    if (!player.displayName && !user) {
      setShowNamePrompt(true);
    }
  }, [user]);

  const handleOpenTutorial = () => {
    setTutorialStep(0);
    setShowTutorial(true);
    if (gameState && !gameState.completed) {
      setTimerPauseStart(Date.now());
    }
  };

  const handleCloseTutorial = (markSeen = false) => {
    if (timerPauseStart && gameState && !gameState.completed) {
      const pausedMs = Date.now() - timerPauseStart;
      const updated = { ...gameState, startTimeMs: gameState.startTimeMs + pausedMs };
      setGameState(updated);
      saveDailyState(gameState.puzzleNumber, updated);
    }
    setTimerPauseStart(null);
    setShowTutorial(false);
    if (markSeen) setSeenTutorial();
  };

  const handleGuess = (artist: string, title: string) => {
    if (!gameState || gameState.completed) return;

    submitGuess.mutate({ data: { artist, title } }, {
      onSuccess: (result: any) => {
        const newGuesses = [...gameState.guesses, { artist, title, correct: result.correct, hint: result.hint || null }];
        const won = result.correct;
        const completed = won || newGuesses.length >= 5;
        const solveTimeMs = completed ? Date.now() - gameState.startTimeMs : gameState.solveTimeMs ?? null;
        const newState: DailyState = {
          ...gameState,
          guesses: newGuesses,
          won,
          completed,
          solveTimeMs,
          stagesRevealed: completed ? gameState.stagesRevealed : Math.min(gameState.stagesRevealed + 1, 5)
        };

        setGameState(newState);
        saveDailyState(gameState.puzzleNumber, newState);

        if (completed) {
          setShowResult(true);
        } else {
          toast({
            title: "Wrong guess!",
            description: result.hint || "Try again with the new clue.",
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleSubmitScore = async (country: string | null): Promise<{ saved: boolean }> => {
    if (!gameState) return { saved: false };
    const player = getPlayerData();
    if (country) {
      player.country = country;
      savePlayerData(player);
    }

    return new Promise<{ saved: boolean }>((resolve, reject) => {
      submitResult.mutate({
        data: {
          playerId: player.playerId,
          displayName: user?.firstName || player.displayName || "Anonymous",
          cluesUsed: gameState.guesses.length,
          won: gameState.won,
          solveTimeMs: gameState.solveTimeMs ?? null,
          country: country ?? player.country ?? null,
          clerkUserId: user?.id || null,
        }
      }, {
        onSuccess: (res: any) => {
          const updatedState: DailyState = {
            ...gameState,
            resultSubmitted: true,
            country: country ?? gameState.country ?? null,
            pointsEarned: res?.pointsEarned ?? gameState.pointsEarned ?? 0,
          };
          setGameState(updatedState);
          saveDailyState(gameState.puzzleNumber, updatedState);
          window.dispatchEvent(new Event("lyricle:points-updated"));
          resolve({ saved: true });
        },
        onError: (err: any) => {
          const status = err?.response?.status ?? err?.status;
          if (status === 401) {
            resolve({ saved: false });
          } else {
            reject(err);
          }
        },
      });
    });
  };

  const handleRetry = () => {
    if (!gameState || gameState.retryUsed || gameState.resultSubmitted) return;
    const resetState: DailyState = {
      ...gameState,
      guesses: [],
      completed: false,
      won: false,
      stagesRevealed: 1,
      startTimeMs: Date.now(),
      solveTimeMs: null,
      retryUsed: true,
    };
    setGameState(resetState);
    saveDailyState(gameState.puzzleNumber, resetState);
    setShowResult(false);
    toast({ title: "Fresh attempt!", description: "Your extra try is ready. Good luck." });
  };

  const { data: clues = [] } = useGetPuzzleClue(Math.min(gameState?.stagesRevealed ?? 1, 4), {
    query: {
      enabled: !!gameState,
      queryKey: getGetPuzzleClueQueryKey(Math.min(gameState?.stagesRevealed ?? 1, 4))
    }
  });

  // Pre-fetch all revealed clues
  const clueStages = [0, 1, 2, 3, 4];
  
  if (puzzleError) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <h2 className="text-3xl font-serif font-bold text-foreground mb-3">Something went wrong</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We couldn't load today's puzzle. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} className="gap-2">
              <Loader2 className="w-4 h-4" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (puzzleLoading || !gameState || !puzzle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <div>
            <h2 className="text-4xl font-serif font-black tracking-tighter uppercase italic">Today's Piece</h2>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
              Issue #{puzzle.puzzleNumber} • {new Date(puzzle.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiveTimer
              startTimeMs={gameState.startTimeMs}
              completed={gameState.completed}
              frozenMs={gameState.solveTimeMs}
              pausedAt={timerPauseStart}
            />
            <Button variant="ghost" size="icon" onClick={handleOpenTutorial} data-testid="button-help">
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {clueStages.map((stage) => {
            const isRevealed = stage < gameState.stagesRevealed || gameState.completed;
            return (
              <ClueRenderer 
                key={stage} 
                stage={stage} 
                isRevealed={isRevealed} 
                isActive={stage === gameState.stagesRevealed - 1 && !gameState.completed}
              />
            );
          })}
        </div>

        <div className="mt-12 sticky bottom-8 z-40">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-md">
            <GuessInput 
              onGuess={handleGuess} 
              disabled={gameState.completed || submitGuess.isPending} 
            />
            
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {gameState.guesses.map((guess, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "px-3 py-1 text-xs font-mono border rounded uppercase tracking-wider line-through opacity-50",
                    guess.correct ? "border-primary text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  {guess.artist}: {guess.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <ResultModal 
        open={showResult} 
        onOpenChange={setShowResult} 
        state={gameState}
        isLoggedIn={!!user}
        submitting={submitResult.isPending}
        onSubmitScore={handleSubmitScore}
        onRetry={handleRetry}
        onSignIn={() => { window.location.href = `${basePathHref}/sign-in`; }}
        onOpenStats={() => { setShowResult(false); setShowStats(true); }}
        onOpenLeaderboard={() => { window.location.href = `${basePathHref}/leaderboard?highlight=me`; }}
      />

      <StatsModal 
        open={showStats} 
        onOpenChange={setShowStats} 
      />

      <TutorialDialog
        open={showTutorial}
        step={tutorialStep}
        onStepChange={setTutorialStep}
        onClose={() => handleCloseTutorial(false)}
        onDone={() => handleCloseTutorial(true)}
      />

      <Dialog open={showNamePrompt} onOpenChange={setShowNamePrompt}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif font-black italic">Who are you?</DialogTitle>
            <DialogDescription>
              Set a display name for the leaderboard. You can change this later by signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Stage Name"
              className="w-full h-12 bg-secondary/60 border border-border rounded-lg px-4 font-sans focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-display-name"
            />
          </div>
          <DialogFooter>
            <Button 
              className="w-full font-bold uppercase" 
              disabled={!displayName.trim()} 
              onClick={() => {
                const player = getPlayerData();
                player.displayName = displayName;
                localStorage.setItem("lyricle_player", JSON.stringify(player));
                setShowNamePrompt(false);
              }}
              data-testid="button-save-name"
            >
              Save & Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClueRenderer({ stage, isRevealed, isActive }: { stage: number, isRevealed: boolean, isActive: boolean }) {
  const { data: clue, isLoading } = useGetPuzzleClue(stage, {
    query: {
      enabled: isRevealed || isActive,
      queryKey: getGetPuzzleClueQueryKey(stage)
    }
  });

  if (isLoading || !clue) {
    return (
      <div className="w-full h-24 bg-card/20 animate-pulse rounded-xl border border-dashed border-border" />
    );
  }

  return <ClueCard clue={clue} index={stage} revealed={isRevealed} />;
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Lyricle 🎵",
    content: (
      <div className="space-y-4 text-foreground/80">
        <p>
          Each day a new song puzzle drops. Your goal: guess the <span className="text-primary font-bold">artist & title</span> using as few clues as possible.
        </p>
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2 font-mono text-sm">
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold">5</span>
            <span className="text-muted-foreground">clue stages to unlock</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold">5</span>
            <span className="text-muted-foreground">guesses before game over</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-primary font-bold">1</span>
            <span className="text-muted-foreground">new puzzle every midnight</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Fewer clues used + faster solve time = more points on the leaderboard.
        </p>
      </div>
    ),
  },
  {
    title: "The 5 Stages",
    content: (
      <div className="space-y-3">
        {[
          { n: "01", label: "Obscure Clue", desc: "A witty, culture-reference clue that evokes the song without naming it." },
          { n: "02", label: "Vibes & Themes", desc: "AI-analyzed mood and keyword themes pulled from the lyrics." },
          { n: "03", label: "Lyric Snippet", desc: "A direct line from the song's official lyrics." },
          { n: "04", label: "Album Art", desc: "The cover art for this release. Getting warmer." },
          { n: "05", label: "Audio Preview", desc: "A 30-second clip. If you don't know by now, use your ears." },
        ].map(({ n, label, desc }) => (
          <div key={n} className="flex gap-3 items-start">
            <span className="font-mono text-primary font-bold text-sm mt-0.5 shrink-0">{n}</span>
            <div>
              <p className="font-semibold text-foreground text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "How to Guess",
    content: (
      <div className="space-y-4 text-foreground/80">
        <p className="text-sm">Type the artist name and song title in the search box at the bottom of the screen. Select from the autocomplete dropdown.</p>
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3 text-sm">
          <div className="flex gap-2 items-start">
            <span className="text-green-500 font-bold shrink-0">✓</span>
            <span>Correct guess → puzzle complete! Your time stops.</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-red-400 font-bold shrink-0">✗</span>
            <span>Wrong guess → next stage unlocks automatically.</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-primary font-bold shrink-0">⏱</span>
            <span>Timer is paused while you read this guide. It resumes when you close it.</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono text-center uppercase tracking-widest">
          Log in to save your score &amp; compete on the leaderboard
        </p>
      </div>
    ),
  },
];

function TutorialDialog({
  open,
  step,
  onStepChange,
  onClose,
  onDone,
}: {
  open: boolean;
  step: number;
  onStepChange: (s: number) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              {step + 1} / {TUTORIAL_STEPS.length}
            </span>
            <div className="flex gap-1">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-border"}`}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-2xl font-serif font-black italic">
            {current.title}
          </DialogTitle>
        </DialogHeader>

        <DialogDescription asChild>
          <div className="py-2">{current.content}</div>
        </DialogDescription>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1 font-semibold" onClick={() => onStepChange(step - 1)}>
              Back
            </Button>
          )}
          {isLast ? (
            <Button className="flex-1 font-bold uppercase tracking-widest" onClick={onDone}>
              Let's Play
            </Button>
          ) : (
            <Button className="flex-1 font-bold" onClick={() => onStepChange(step + 1)}>
              Next →
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
