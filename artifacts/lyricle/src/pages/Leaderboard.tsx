import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Trophy,
  Star,
  Pencil,
  Music,
} from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { flagEmoji, countryName } from "@/lib/countries";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

interface GuesserEntry {
  rank: number;
  userId: string;
  displayName: string;
  country?: string | null;
  points: number;
  puzzlesPlayed: number;
  puzzlesWon: number;
  isMe: boolean;
}

interface CreatorEntry {
  rank: number;
  userId: string;
  displayName: string;
  country?: string | null;
  totalPlays: number;
  puzzleCount: number;
  isMe: boolean;
}

function PlayerName({ name, country }: { name: string; country?: string | null }) {
  const flag = flagEmoji(country);
  const title = countryName(country);
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && (
        <span className="text-base leading-none" title={title ?? undefined}>
          {flag}
        </span>
      )}
      <span className="font-medium text-foreground">{name}</span>
    </span>
  );
}

interface LeaderboardResponse<T> {
  entries: T[];
  myEntry: T | null;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span title="1st place">🥇</span>;
  if (rank === 2) return <span title="2nd place">🥈</span>;
  if (rank === 3) return <span title="3rd place">🥉</span>;
  return <span className="font-mono text-muted-foreground">#{rank}</span>;
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array(5).fill(0).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td colSpan={cols} className="px-6 py-5 bg-secondary/10" />
        </tr>
      ))}
    </>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Leaderboard() {
  const { user } = useUser();

  const [guessers, setGuessers] = useState<LeaderboardResponse<GuesserEntry> | null>(null);
  const [guessersLoading, setGuessersLoading] = useState(true);

  const [creators, setCreators] = useState<LeaderboardResponse<CreatorEntry> | null>(null);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [creatorsLoaded, setCreatorsLoaded] = useState(false);

  useEffect(() => {
    setGuessersLoading(true);
    fetch(apiUrl("/leaderboard/guessers"))
      .then((r) => r.json())
      .then((data) => setGuessers(data))
      .catch(() => setGuessers({ entries: [], myEntry: null }))
      .finally(() => setGuessersLoading(false));
  }, []);

  function loadCreators() {
    if (creatorsLoaded) return;
    setCreatorsLoading(true);
    fetch(apiUrl("/leaderboard/creators"))
      .then((r) => r.json())
      .then((data) => setCreators(data))
      .catch(() => setCreators({ entries: [], myEntry: null }))
      .finally(() => {
        setCreatorsLoading(false);
        setCreatorsLoaded(true);
      });
  }

  const myGuesserRank = guessers?.myEntry?.rank ?? null;
  const myCreatorRank = creators?.myEntry?.rank ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />

      <main className="container max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-serif font-black tracking-tighter uppercase italic">
              The Charts
            </h1>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
              Top Guessers • Top Creators • All-Time
            </p>
          </div>
        </div>

        <Tabs defaultValue="guessers" onValueChange={(v) => v === "creators" && loadCreators()}>
          <TabsList className="w-full mb-6 h-auto p-1 bg-secondary/30 border border-border rounded-xl">
            <TabsTrigger
              value="guessers"
              className="flex-1 flex items-center gap-2 py-2 text-xs font-mono uppercase tracking-widest"
              data-testid="tab-guessers"
            >
              <Star className="w-3.5 h-3.5" />
              Top Guessers
              {user && myGuesserRank && (
                <span className="ml-1 text-[10px] opacity-60">#{myGuesserRank}</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="creators"
              className="flex-1 flex items-center gap-2 py-2 text-xs font-mono uppercase tracking-widest"
              data-testid="tab-creators"
            >
              <Pencil className="w-3.5 h-3.5" />
              Top Creators
              {user && myCreatorRank && (
                <span className="ml-1 text-[10px] opacity-60">#{myCreatorRank}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Top Guessers */}
          <TabsContent value="guessers">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  <h2 className="font-serif text-xl font-bold italic">Top Guessers</h2>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                  Top 50 · All-time · Ranked by total points earned
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="px-6 py-4 font-medium">Rank</th>
                      <th className="px-6 py-4 font-medium">Player</th>
                      <th className="px-6 py-4 font-medium text-right">⭐ Points</th>
                      <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">Played</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {guessersLoading ? (
                      <SkeletonRows cols={4} />
                    ) : guessers && guessers.entries.length > 0 ? (
                      <>
                        {guessers.entries.map((entry) => (
                          <tr
                            key={entry.userId}
                            className={cn(
                              "group transition-colors",
                              entry.isMe
                                ? "bg-primary/10 border-l-2 border-l-primary"
                                : "hover:bg-secondary/20"
                            )}
                          >
                            <td className="px-6 py-4 font-mono font-bold text-primary">
                              <RankBadge rank={entry.rank} />
                            </td>
                            <td className="px-6 py-4">
                              <PlayerName name={entry.displayName} country={entry.country} />
                              {entry.isMe && (
                                <span className="ml-2 text-[10px] font-mono text-primary uppercase tracking-wider opacity-70">you</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                              {entry.points.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                              {entry.puzzlesPlayed}
                            </td>
                          </tr>
                        ))}
                        {guessers.myEntry && !guessers.entries.some((e) => e.isMe) && (
                          <>
                            <tr>
                              <td colSpan={4} className="px-6 py-2 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                · · ·
                              </td>
                            </tr>
                            <tr className="bg-primary/10 border-l-2 border-l-primary">
                              <td className="px-6 py-4 font-mono font-bold text-primary">
                                <RankBadge rank={guessers.myEntry.rank} />
                              </td>
                              <td className="px-6 py-4">
                                <PlayerName name={guessers.myEntry.displayName} country={guessers.myEntry.country} />
                                <span className="ml-2 text-[10px] font-mono text-primary uppercase tracking-wider opacity-70">you</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                                {guessers.myEntry.points.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                {guessers.myEntry.puzzlesPlayed}
                              </td>
                            </tr>
                          </>
                        )}
                      </>
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
                          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                          <p className="text-sm font-mono text-muted-foreground">No players yet. Play a puzzle to earn points!</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Top Creators */}
          <TabsContent value="creators">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" />
                  <h2 className="font-serif text-xl font-bold italic">Top Creators</h2>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                  Top 50 · All-time · Ranked by total plays received
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="px-6 py-4 font-medium">Rank</th>
                      <th className="px-6 py-4 font-medium">Creator</th>
                      <th className="px-6 py-4 font-medium text-right">🎵 Total Plays</th>
                      <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">Puzzles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {creatorsLoading ? (
                      <SkeletonRows cols={4} />
                    ) : creators && creators.entries.length > 0 ? (
                      <>
                        {creators.entries.map((entry) => (
                          <tr
                            key={entry.userId}
                            className={cn(
                              "group transition-colors",
                              entry.isMe
                                ? "bg-primary/10 border-l-2 border-l-primary"
                                : "hover:bg-secondary/20"
                            )}
                          >
                            <td className="px-6 py-4 font-mono font-bold text-primary">
                              <RankBadge rank={entry.rank} />
                            </td>
                            <td className="px-6 py-4">
                              <PlayerName name={entry.displayName} country={entry.country} />
                              {entry.isMe && (
                                <span className="ml-2 text-[10px] font-mono text-primary uppercase tracking-wider opacity-70">you</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                              {entry.totalPlays.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                              {entry.puzzleCount}
                            </td>
                          </tr>
                        ))}
                        {creators.myEntry && !creators.entries.some((e) => e.isMe) && (
                          <>
                            <tr>
                              <td colSpan={4} className="px-6 py-2 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                · · ·
                              </td>
                            </tr>
                            <tr className="bg-primary/10 border-l-2 border-l-primary">
                              <td className="px-6 py-4 font-mono font-bold text-primary">
                                <RankBadge rank={creators.myEntry.rank} />
                              </td>
                              <td className="px-6 py-4">
                                <PlayerName name={creators.myEntry.displayName} country={creators.myEntry.country} />
                                <span className="ml-2 text-[10px] font-mono text-primary uppercase tracking-wider opacity-70">you</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                                {creators.myEntry.totalPlays.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                {creators.myEntry.puzzleCount}
                              </td>
                            </tr>
                          </>
                        )}
                      </>
                    ) : creatorsLoaded ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
                          <Music className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                          <p className="text-sm font-mono text-muted-foreground">No creators yet. Be the first to make a puzzle!</p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
