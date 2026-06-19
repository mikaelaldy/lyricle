import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, ArrowLeft, Check, Copy, Music2, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

interface TrackResult {
  trackId: number;
  title: string;
  artist: string;
  albumArt: string | null;
}

interface SelectedTrack extends TrackResult {
  lyrics?: string[];
}

const STEP_LABELS = [
  "Pick a Song",
  "Write Your Clue",
  "Choose a Line",
  "Share It",
];

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export default function CreatePuzzle() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<SelectedTrack | null>(null);
  const [personalClue, setPersonalClue] = useState("");
  const [lyrics, setLyrics] = useState<string[]>([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [maskedIndex, setMaskedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoaded && !user) {
      setLocation("/sign-in");
    }
  }, [isLoaded, user, setLocation]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(apiUrl(`/search?q=${encodeURIComponent(query.trim())}`));
        if (res.ok) {
          const data = await res.json() as { tracks: TrackResult[] };
          setResults(data.tracks ?? []);
        }
      } catch {
        // silently ignore network errors
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selectTrack(track: TrackResult) {
    setSelectedTrack(track);
    setResults([]);
    setQuery("");
    setStep(1);
  }

  async function goToLyrics() {
    if (!selectedTrack) return;
    setLoadingLyrics(true);
    setStep(2);
    try {
      const res = await fetch(apiUrl(`/lyrics/${selectedTrack.trackId}`));
      if (res.ok) {
        const data = await res.json() as { lines: string[] };
        setLyrics(data.lines ?? []);
      } else {
        toast({ title: "Lyrics unavailable", description: "Couldn't load lyrics for this track.", variant: "destructive" });
        setStep(1);
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" });
      setStep(1);
    } finally {
      setLoadingLyrics(false);
    }
  }

  async function savePuzzle() {
    if (!selectedTrack || maskedIndex === null || !personalClue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/puzzles"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrack.trackId,
          trackName: selectedTrack.title,
          artistName: selectedTrack.artist,
          albumArt: selectedTrack.albumArt,
          personalClue: personalClue.trim(),
          maskedLyricIndex: maskedIndex,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { puzzleId: string };
        setPuzzleId(data.puzzleId);
        setStep(3);
      } else {
        const err = await res.json() as { error?: string };
        toast({ title: "Failed to save", description: err.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!puzzleId) return;
    const link = `${window.location.origin}${basePath}/p/${puzzleId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!isLoaded) return null;

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary/20 border-2 border-primary text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] mt-1 font-medium hidden sm:block ${i === step ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px flex-1 mx-1 transition-all ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 0: Search for a song */}
          {step === 0 && (
            <motion.div key="step0" {...fadeIn}>
              <div className="space-y-2 mb-6">
                <h1 className="font-serif text-3xl font-black text-foreground">Pick a song</h1>
                <p className="text-muted-foreground">Search for the track you want to build a puzzle around.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search songs, artists…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-12 text-base"
                />
              </div>

              <AnimatePresence>
                {(results.length > 0 || searching) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
                  >
                    {searching && results.length === 0 && (
                      <div className="p-4 text-muted-foreground text-sm text-center">Searching…</div>
                    )}
                    {results.map((track) => (
                      <button
                        key={track.trackId}
                        onClick={() => selectTrack(track)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                      >
                        {track.albumArt ? (
                          <img src={track.albumArt} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Music2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">{track.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{track.artist}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {query.trim().length > 0 && query.trim().length < 2 && (
                <p className="text-muted-foreground text-sm mt-3">Type at least 2 characters to search</p>
              )}
            </motion.div>
          )}

          {/* Step 1: Personal clue */}
          {step === 1 && selectedTrack && (
            <motion.div key="step1" {...fadeIn}>
              <div className="flex items-center gap-3 mb-6 p-4 bg-card border border-border rounded-xl">
                {selectedTrack.albumArt ? (
                  <img src={selectedTrack.albumArt} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Music2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate">{selectedTrack.title}</div>
                  <div className="text-sm text-muted-foreground truncate">{selectedTrack.artist}</div>
                </div>
                <button
                  onClick={() => { setSelectedTrack(null); setStep(0); }}
                  className="ml-auto text-muted-foreground hover:text-foreground text-xs underline flex-shrink-0"
                >
                  Change
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <h1 className="font-serif text-3xl font-black text-foreground">Write your clue</h1>
                <p className="text-muted-foreground">Share a personal memory or feeling tied to this song. This is Stage 1 — what players see first.</p>
              </div>

              <Textarea
                autoFocus
                placeholder="e.g. I listen to this when I'm driving alone at 2am and everything feels possible."
                value={personalClue}
                onChange={(e) => setPersonalClue(e.target.value)}
                rows={4}
                className="text-base resize-none"
                maxLength={280}
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${personalClue.length >= 280 ? "text-destructive" : "text-muted-foreground"}`}>
                  {personalClue.length}/280
                </p>
                {personalClue.trim().length < 10 && personalClue.trim().length > 0 && (
                  <p className="text-xs text-muted-foreground">At least 10 characters</p>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={personalClue.trim().length < 10}
                  onClick={goToLyrics}
                >
                  Next: Pick a lyric line <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Pick a lyric line to mask */}
          {step === 2 && (
            <motion.div key="step2" {...fadeIn}>
              <div className="space-y-2 mb-5">
                <h1 className="font-serif text-3xl font-black text-foreground">Choose a line to hide</h1>
                <p className="text-muted-foreground">Tap a lyric line. Players will see <span className="text-primary font-medium">[ ??? ]</span> in its place and must guess the song.</p>
              </div>

              {loadingLyrics && (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm">Loading lyrics…</span>
                </div>
              )}

              {!loadingLyrics && lyrics.length > 0 && (
                <>
                  <div className="space-y-1 max-h-96 overflow-y-auto rounded-xl border border-border p-2">
                    {lyrics.map((line, i) => (
                      <button
                        key={i}
                        onClick={() => setMaskedIndex(maskedIndex === i ? null : i)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all font-mono leading-relaxed ${
                          maskedIndex === i
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-accent text-foreground"
                        }`}
                      >
                        {maskedIndex === i ? (
                          <span className="flex items-center gap-2">
                            <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                            {line}
                            <span className="ml-auto text-xs opacity-75">masked</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            {line}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {maskedIndex !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-primary font-medium">Players will see this as <code className="bg-primary/20 px-1 rounded">[ ??? ]</code></span>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-2 mt-5">
                    <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={maskedIndex === null || saving}
                      onClick={savePuzzle}
                    >
                      {saving ? (
                        <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Saving…</>
                      ) : (
                        <>Create Puzzle <ArrowRight className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {!loadingLyrics && lyrics.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No lyrics found for this track.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>
                    Go back and pick another
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Share screen */}
          {step === 3 && puzzleId && (
            <motion.div key="step3" {...fadeIn}>
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } }}
                  className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <Sparkles className="w-10 h-10 text-primary" />
                </motion.div>

                <h1 className="font-serif text-3xl font-black text-foreground mb-2">Puzzle created!</h1>
                <p className="text-muted-foreground mb-8">
                  Share the link below and earn points every time someone plays it.
                </p>

                {selectedTrack && (
                  <div className="flex items-center gap-3 mb-6 p-4 bg-card border border-border rounded-xl mx-auto max-w-sm">
                    {selectedTrack.albumArt ? (
                      <img src={selectedTrack.albumArt} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Music2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-left min-w-0">
                      <div className="font-bold text-foreground text-sm truncate">{selectedTrack.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{selectedTrack.artist}</div>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border rounded-xl p-4 mb-4 max-w-sm mx-auto">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Your puzzle link</p>
                  <code className="text-sm text-primary break-all">
                    {window.location.origin}{basePath}/p/{puzzleId}
                  </code>
                </div>

                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                  <Button className="gap-2 h-12" onClick={copyLink}>
                    {copied ? (
                      <><Check className="w-4 h-4" /> Copied!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copy link</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(0);
                      setSelectedTrack(null);
                      setPersonalClue("");
                      setLyrics([]);
                      setMaskedIndex(null);
                      setPuzzleId(null);
                      setQuery("");
                    }}
                  >
                    Create another puzzle
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
