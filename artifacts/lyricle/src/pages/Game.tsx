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
import { getDailyState, saveDailyState, getPlayerData, DailyState, hasSeenTutorial, setSeenTutorial } from "@/lib/storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Loader2, HelpCircle } from "lucide-react";

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
        const newState = {
          ...gameState,
          guesses: newGuesses,
          won,
          completed,
          stagesRevealed: completed ? gameState.stagesRevealed : Math.min(gameState.stagesRevealed + 1, 5)
        };
        
        setGameState(newState);
        saveDailyState(gameState.puzzleNumber, newState);

        if (completed) {
          handleGameComplete(newState);
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

  const handleGameComplete = (finalState: DailyState) => {
    const player = getPlayerData();
    const solveTimeMs = Date.now() - finalState.startTimeMs;

    submitResult.mutate({
      data: {
        playerId: player.playerId,
        displayName: user?.firstName || player.displayName || "Anonymous",
        cluesUsed: finalState.guesses.length,
        won: finalState.won,
        solveTimeMs,
        clerkUserId: user?.id || null
      }
    }, {
      onSuccess: () => {
        const updatedState = { ...finalState, resultSubmitted: true };
        setGameState(updatedState);
        saveDailyState(finalState.puzzleNumber, updatedState);
        setShowResult(true);
      }
    });
  };

  const { data: clues = [] } = useGetPuzzleClue(gameState?.stagesRevealed || 1, {
    query: {
      enabled: !!gameState,
      queryKey: getGetPuzzleClueQueryKey(gameState?.stagesRevealed || 1)
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
          <Button variant="ghost" size="icon" onClick={() => setShowTutorial(true)} data-testid="button-help">
            <HelpCircle className="w-5 h-5" />
          </Button>
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
        onOpenStats={() => { setShowResult(false); setShowStats(true); }}
        onOpenLeaderboard={() => { window.location.href = "/leaderboard"; }}
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
