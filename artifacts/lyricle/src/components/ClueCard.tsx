import { PuzzleClue } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Quote, Sparkles, FileText, ImageIcon, Volume2 } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

interface ClueCardProps {
  clue: PuzzleClue;
  index: number;
  revealed: boolean;
}

const STAGE_ICONS = [Quote, Sparkles, FileText, ImageIcon, Volume2];

export default function ClueCard({ clue, index, revealed }: ClueCardProps) {
  const Icon = STAGE_ICONS[index] ?? FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full mb-6"
    >
      <div className="flex items-center gap-2 mb-3 text-primary/70 font-mono text-xs uppercase tracking-widest">
        <Icon className="w-4 h-4" />
        <span>Stage {index + 1}: {clue.stageLabel}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

        <AnimatePresence mode="wait">
          {revealed ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="relative z-10"
            >
              {index === 0 && (
                <div>
                  {clue.personalNote ? (
                    <blockquote className="text-2xl font-serif leading-relaxed italic border-l-2 border-primary/30 pl-4 py-1">
                      {clue.personalNote}
                    </blockquote>
                  ) : (
                    <div className="text-muted-foreground italic text-sm">Obscure clue unavailable for this track.</div>
                  )}
                </div>
              )}

              {index === 1 && (
                <div className="space-y-4">
                  {clue.themes && clue.themes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {clue.themes.map((theme: string) => (
                        <Badge key={theme} variant="secondary" className="bg-secondary/50 text-foreground border-border px-3 py-1 text-sm font-medium">
                          #{theme}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic text-sm">Themes unavailable for this track.</div>
                  )}
                  {clue.mood ? (
                    <div className="text-xl font-serif italic text-muted-foreground">
                      &ldquo;Feeling {clue.mood.toLowerCase()}...&rdquo;
                    </div>
                  ) : null}
                </div>
              )}

              {index === 2 && (
                <div className="relative">
                  <div className="absolute -left-6 top-0 h-full w-[2px] bg-gradient-to-b from-primary/50 via-transparent to-primary/50 opacity-30" />
                  <blockquote className="text-2xl font-serif leading-relaxed font-bold text-foreground py-2">
                    {clue.snippet ?? <span className="text-muted-foreground italic text-base font-normal">Lyric snippet unavailable.</span>}
                  </blockquote>
                </div>
              )}

              {index === 3 && (
                <div className="flex justify-center">
                  {clue.albumArtUrl ? (
                    <div className="relative w-44 h-44 rounded-xl overflow-hidden border border-border shadow-2xl ring-1 ring-white/10">
                      <img
                        src={clue.albumArtUrl}
                        alt="Album Art"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic text-sm text-center py-4">Album art unavailable.</div>
                  )}
                </div>
              )}

              {index === 4 && (
                <div>
                  {clue.previewUrl ? (
                    <AudioPlayer src={clue.previewUrl} />
                  ) : (
                    <div className="text-center p-4 border border-dashed border-border rounded-lg bg-secondary text-muted-foreground italic">
                      Audio preview not available for this track.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-muted rounded-lg opacity-20">
              <span className="font-mono text-sm tracking-widest uppercase">Locked</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
