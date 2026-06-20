import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Loader2, Headphones, FileText, Image, Trophy, ArrowRight, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import GuessInput from "@/components/GuessInput";
import AudioPlayer from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface DuelDetails {
  id: string;
  wager: number;
  puzzleType: "daily" | "ugc";
  puzzleRef: string;
  creatorName: string;
  creatorCluesUsed: number;
  creatorWon: boolean;
}

interface UGCPuzzleData {
  id: string;
  personalClue: string;
  maskedLyricIndex: number;
}

interface UGCMediaData {
  lyrics: string[];
  audioPreviewUrl: string | null;
  albumArt: string | null;
}

interface DailyClue {
  stage: number;
  stageLabel: string;
  themes?: string[];
  mood?: string;
  translatedLine?: string;
  translationLanguage?: string;
  snippet?: string;
  richsyncWords?: { word: string; startMs: number; endMs: number }[];
  previewUrl?: string;
  albumArtUrl?: string;
}

export default function PlayDuel({ params }: { params: { id: string } }) {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [duel, setDuel] = useState<DuelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [startTime] = useState(() => Date.now());
  const [guessing, setGuessing] = useState(false);

  // UGC State
  const [ugcPuzzle, setUgcPuzzle] = useState<UGCPuzzleData | null>(null);
  const [ugcMedia, setUgcMedia] = useState<UGCMediaData | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  // Daily State
  const [dailyClues, setDailyClues] = useState<DailyClue[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setLocation("/sign-in");
      return;
    }

    const fetchDuel = async () => {
      try {
        const res = await fetch(`/api/duels/${params.id}`);
        const data = await res.json();
        if (res.ok) {
          setDuel(data.duel);
          if (data.duel.puzzleType === "ugc") {
            // Load UGC Puzzle Metadata
            const pRes = await fetch(`/api/puzzles/${data.duel.puzzleRef}`);
            const pData = await pRes.json();
            setUgcPuzzle(pData);

            // Load UGC Puzzle Media
            setMediaLoading(true);
            const mRes = await fetch(`/api/puzzles/${data.duel.puzzleRef}/media`);
            const mData = await mRes.json();
            setUgcMedia(mData);
            setMediaLoading(false);
          } else {
            // Load Daily Puzzle Clues up to current stage
            const cluesList: DailyClue[] = [];
            for (let i = 0; i < 5; i++) {
              const cRes = await fetch(`/api/puzzle/clue/${i}`);
              if (cRes.ok) {
                const cData = await cRes.json();
                cluesList.push(cData);
              }
            }
            setDailyClues(cluesList);
          }
        } else {
          toast({ title: "Duel not found", variant: "destructive" });
          setLocation("/lobby");
        }
      } catch {
        toast({ title: "Error loading duel data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchDuel();
  }, [params.id, user, isLoaded]);

  const handleGuess = async (artist: string, title: string) => {
    if (guessing) return;
    setGuessing(true);

    const guessText = `${artist} — ${title}`;
    const newGuesses = [...guesses, guessText];
    setGuesses(newGuesses);

    try {
      if (duel?.puzzleType === "ugc") {
        const res = await fetch(`/api/puzzles/${duel.puzzleRef}/guess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist, title }),
        });
        const data = await res.json();

        if (data.correct) {
          await submitDuelResult(true, newGuesses.length);
        } else {
          if (newGuesses.length >= 4) {
            await submitDuelResult(false, newGuesses.length);
          } else {
            setStage((s) => s + 1);
            toast({ title: "Wrong guess!", description: "Advancing to next stage clue." });
          }
        }
      } else {
        // Daily puzzle guess check
        const res = await fetch("/api/puzzle/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist, title }),
        });
        const data = await res.json();

        if (data.correct) {
          await submitDuelResult(true, newGuesses.length);
        } else {
          if (newGuesses.length >= 5) {
            await submitDuelResult(false, newGuesses.length);
          } else {
            setStage((s) => s + 1);
            toast({ title: "Wrong guess!", description: "Advancing to next stage clue." });
          }
        }
      }
    } catch {
      toast({ title: "Failed to submit guess", variant: "destructive" });
    } finally {
      setGuessing(false);
    }
  };

  const submitDuelResult = async (won: boolean, cluesCount: number) => {
    const solveTimeMs = Date.now() - startTime;
    try {
      const res = await fetch(`/api/duels/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluesUsed: cluesCount, solveTimeMs, won }),
      });
      if (res.ok) {
        toast({ title: "Duel completed!", description: "Your score was uploaded to the arena." });
        setLocation("/lobby");
      } else {
        toast({ title: "Submission failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Result submission failed", variant: "destructive" });
    }
  };

  if (loading || !duel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const maxStages = duel.puzzleType === "ugc" ? 4 : 5;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        
        {/* Duel Header */}
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <div>
            <h2 className="text-4xl font-serif font-black tracking-tighter uppercase italic">Wager Duel</h2>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
              VS {duel.creatorName} • Wager: {duel.wager} pts
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/70 border border-border font-mono text-sm font-bold tabular-nums">
            Stage {stage + 1}/{maxStages}
          </div>
        </div>

        {/* Clue Area */}
        <div className="space-y-6">
          {duel.puzzleType === "ugc" ? (
            <div className="space-y-4">
              {/* Stage 0 - Creator Clue */}
              {ugcPuzzle && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-md">
                  <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider mb-2 block">Stage 1 · Personal Clue</span>
                  <blockquote className="text-lg italic font-serif">“{ugcPuzzle.personalClue}”</blockquote>
                </div>
              )}

              {/* Stage 1 - Lyrics snippet with masked line */}
              {stage >= 1 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-md">
                  <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider mb-2 block">Stage 2 · Masked Lyrics</span>
                  {mediaLoading || !ugcMedia ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <div className="space-y-1 font-mono text-xs leading-relaxed max-h-60 overflow-y-auto">
                      {ugcMedia.lyrics.map((line, i) =>
                        i === ugcPuzzle?.maskedLyricIndex ? (
                          <div key={i} className="px-2 py-1 bg-primary/10 border border-primary/30 rounded text-primary font-bold">
                            [ ??? ]
                          </div>
                        ) : (
                          <div key={i} className="px-2 py-0.5 text-muted-foreground">{line}</div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stage 2 - Album Art */}
              {stage >= 2 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-md">
                  <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider mb-2 block">Stage 3 · Album Art</span>
                  {ugcMedia?.albumArt ? (
                    <img src={ugcMedia.albumArt} alt="" width={160} height={160} className="w-40 h-40 rounded-xl object-cover mx-auto shadow-lg" />
                  ) : (
                    <div className="w-40 h-40 rounded-xl bg-muted flex items-center justify-center mx-auto">
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}

              {/* Stage 3 - Audio Preview */}
              {stage >= 3 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-md">
                  <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider mb-2 block">Stage 4 · Audio Snippet</span>
                  {ugcMedia?.audioPreviewUrl ? (
                    <AudioPlayer src={ugcMedia.audioPreviewUrl} />
                  ) : (
                    <div className="text-center p-4 border border-dashed border-border rounded-lg bg-secondary text-muted-foreground italic">
                      Audio preview unavailable.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Daily puzzle clues
            <div className="space-y-4">
              {dailyClues.map((c, i) => {
                if (i > stage) return null;
                return (
                  <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-md">
                    <span className="text-[10px] font-mono font-bold uppercase text-primary tracking-wider mb-2 block">
                      Stage {i + 1} · {c.stageLabel}
                    </span>
                    
                    {i === 0 && (
                      <div className="space-y-2">
                        {c.themes && (
                          <div className="flex flex-wrap gap-1.5">
                            {c.themes.map((t) => (
                              <span key={t} className="px-2 py-0.5 text-xs bg-secondary rounded border border-border">#{t}</span>
                            ))}
                          </div>
                        )}
                        {c.mood && <p className="text-base italic text-muted-foreground font-serif">“Feeling {c.mood.toLowerCase()}…”</p>}
                      </div>
                    )}

                    {i === 1 && (
                      <div>
                        <span className="text-xs font-mono text-muted-foreground block mb-1">In {c.translationLanguage}:</span>
                        <blockquote className="text-lg italic font-serif">“{c.translatedLine}”</blockquote>
                      </div>
                    )}

                    {i === 2 && (
                      <blockquote className="text-lg font-bold font-serif">“{c.snippet}”</blockquote>
                    )}

                    {i === 3 && (
                      <div className="flex flex-wrap gap-1.5 font-serif font-black text-xl tracking-tight">
                        {c.richsyncWords?.map((w, index) => (
                          <span key={index}>{w.word}</span>
                        ))}
                      </div>
                    )}

                    {i === 4 && (
                      <div className="space-y-4">
                        {c.albumArtUrl && (
                          <img src={c.albumArtUrl} alt="" width={160} height={160} className="w-40 h-40 rounded-xl object-cover mx-auto shadow-lg" />
                        )}
                        {c.previewUrl && <AudioPlayer src={c.previewUrl} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input guess Area */}
        <div className="mt-8 bg-card border border-border p-6 rounded-2xl shadow-md">
          <GuessInput onGuess={handleGuess} disabled={guessing} />

          {/* Recap of wrong guesses */}
          {guesses.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {guesses.map((g, index) => (
                <div key={index} className="px-3 py-1 text-xs font-mono border border-border rounded uppercase tracking-wider line-through opacity-50 text-muted-foreground">
                  {g}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
