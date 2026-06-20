import { useState, useEffect } from "react";
import { useGetTodayPuzzle, useGetPuzzleClue, useSubmitGuess, useSubmitResult, useGetPuzzleAnswer } from "@workspace/api-client-react";
import { getGetTodayPuzzleQueryKey, getGetPuzzleClueQueryKey, getSubmitGuessMutationOptions, getSubmitResultMutationOptions, getGetPuzzleAnswerQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
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

function LiveTimer({ startTimeMs, completed, frozenMs }: { startTimeMs: number; completed: boolean; frozenMs: number | null | undefined }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTimeMs);

  useEffect(() => {
    if (completed) return;
    setElapsed(Date.now() - startTimeMs);
    const id = setInterval(() => setElapsed(Date.now() - startTimeMs), 1000);
    return () => clearInterval(id);
  }, [completed, startTimeMs]);

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
  const { user, isLoaded: clerkLoaded } = useUser();
  const { data: puzzle, isLoading: puzzleLoading, isError: puzzleError } = useGetTodayPuzzle();
  
  const [gameState, setGameState] = useState<DailyState | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
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
    }
    const player = getPlayerData();
    if (!player.displayName && !user) {
      setShowNamePrompt(true);
    }
  }, [user]);

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

  const handleSubmitScore = async (country: string | null) => {
    if (!gameState) return;
    const player = getPlayerData();
    if (country) {
      player.country = country;
      savePlayerData(player);
    }

    return new Promise<void>((resolve, reject) => {
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
          resolve();
        },
        onError: (err: any) => {
          const status = err?.response?.status ?? err?.status;
          if (status === 401) {
            // Not logged in — game is valid but score won't be saved
            resolve();
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
    toast({ title: "Fresh attempt!", description: "Your extra try is ready — good luck." });
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
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">Setup Required</p>
            <h2 className="text-3xl font-serif font-bold text-foreground mb-3">API Key Missing</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Musixmatch API key (MXM_KEY) is not configured. Add it in the Secrets tab to start playing.
            </p>
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
            />
            <Button variant="ghost" size="icon" onClick={() => setShowTutorial(true)} data-testid="button-help">
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
        onOpenLeaderboard={() => { window.location.href = `${basePathHref}/leaderboard`; }}
      />

      <StatsModal 
        open={showStats} 
        onOpenChange={setShowStats} 
      />

      <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-serif font-black text-center italic mb-4">How to Play</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 text-foreground/80">
                <span className="block">Guess the <span className="text-primary font-bold">Lyricle</span> in 5 stages or fewer.</span>
                <ul className="space-y-3 font-medium">
                  <li className="flex gap-3">
                    <span className="font-mono text-primary">01</span>
                    <span>Analyze themes and moods to get a vibe for the track.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-mono text-primary">02</span>
                    <span>Read a translated lyric line—something might sound familiar.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-mono text-primary">03</span>
                    <span>Get a snippet of the actual lyrics.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-mono text-primary">04</span>
                    <span>Watch the words appear as they would be sung.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-mono text-primary">05</span>
                    <span>Listen to the audio preview or see the album art.</span>
                  </li>
                </ul>
                <span className="block text-xs text-muted-foreground mt-4 font-mono uppercase text-center">A new puzzle awaits every day at midnight.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full font-bold uppercase tracking-widest" onClick={() => { setShowTutorial(false); setSeenTutorial(); }}>
              Let's Play
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
