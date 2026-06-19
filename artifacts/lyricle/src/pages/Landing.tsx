import { useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion, useMotionValue, useTransform, animate, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Music2, Users, Trophy, Star, ArrowRight, Share2, Mic2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

interface LiveStats {
  totalCompletions: number;
  playersToday: number;
  streakLeaders: number;
}

const FALLBACK_STATS: LiveStats = {
  totalCompletions: 24800,
  playersToday: 3200,
  streakLeaders: 412,
};

function CountUp({ target, suffix = "", started }: { target: number; suffix?: string; started: boolean }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString() + suffix);
  const [display, setDisplay] = useState("0" + suffix);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  useEffect(() => {
    if (!started) return;
    const ctrl = animate(motionVal, target, { duration: 2, ease: [0.22, 1, 0.36, 1] });
    return () => ctrl.stop();
  }, [started, target, motionVal]);

  return <>{display}</>;
}

function LandingHeader({ onPlay, user, setLocation }: { onPlay: () => void; user: any; setLocation: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={`${basePath}/logo.svg`} alt="Lyricle" className="w-8 h-8" />
          <span className="font-serif text-xl font-black tracking-tight text-primary">LYRICLE</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/game")} className="font-semibold text-gray-600">
                Play
              </Button>
              <Button size="sm" onClick={() => setLocation("/create")} className="rounded-full font-bold px-5 bg-primary text-white hover:bg-primary/90 shadow-sm">
                Create Puzzle
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/sign-in")} className="font-semibold text-gray-600" data-testid="landing-signin-button">
                Sign in
              </Button>
              <Button size="sm" onClick={onPlay} className="rounded-full font-bold px-5 bg-primary text-white hover:bg-primary/90 shadow-sm">
                Play Free
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MockPuzzleCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      className="relative select-none"
    >
      <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-2xl bg-primary/10 border border-primary/10" />
      <div className="relative bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
          </div>
          <span className="text-xs font-semibold text-gray-400 ml-auto font-mono">Lyricle #1247</span>
        </div>

        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest font-mono">Stage 1 · Creator's Clue</span>
          </div>
          <p className="text-sm text-gray-700 italic leading-relaxed">"This song defined my entire summer of '09"</p>
        </div>

        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest font-mono">Stage 2 · Lyrics</span>
          </div>
          <div className="space-y-1 font-mono text-xs leading-relaxed">
            <div className="text-gray-400 px-2 py-0.5">♪ Summer nights and city lights...</div>
            <div className="px-2 py-1 bg-primary/10 border border-primary/30 rounded text-primary font-bold">[ ??? ]</div>
            <div className="text-gray-400 px-2 py-0.5">♪ And you were there beside me</div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-3">
            <span className="text-gray-300 text-sm flex-1 font-sans">Type artist &amp; song...</span>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${i === 0 ? "bg-orange-300" : "bg-gray-200"}`} />
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center font-mono">4 guesses remaining</p>
        </div>
      </div>
    </motion.div>
  );
}

const FEATURES = [
  { icon: Music2, title: "Create Puzzles", description: "Pick any song, write a personal clue only a true fan would understand, and share it with the world." },
  { icon: Users, title: "Challenge Friends", description: "Send your puzzle link and watch them struggle — or help them. That part's up to you." },
  { icon: Star, title: "Earn Points", description: "Win games to earn points. Creators also earn bonus points every time someone plays their puzzle." },
  { icon: Trophy, title: "Top the Charts", description: "Compete with players worldwide across the daily puzzle and user-created challenges." },
];

const STEPS = [
  { icon: Mic2, title: "Play the daily puzzle", description: "A new song drops every day at midnight. Five clues, one song — how quickly can you guess?" },
  { icon: Share2, title: "Create your own", description: "Choose a song, write a personal clue, pick a mystery lyric line, and share your puzzle link." },
  { icon: Trophy, title: "Compete and climb", description: "Earn points for wins and puzzle plays. Rise through the leaderboard and claim your crown." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const goToGame = () => setLocation("/game");

  const statsRef = useRef<HTMLDivElement>(null);
  const inView = useInView(statsRef, { once: true, margin: "-60px" });
  const [stats, setStats] = useState<LiveStats>(FALLBACK_STATS);

  useEffect(() => {
    fetch(`${basePath}/api/stats`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<LiveStats>; })
      .then((data) => setStats({
        totalCompletions: data.totalCompletions > 0 ? data.totalCompletions : FALLBACK_STATS.totalCompletions,
        playersToday: data.playersToday > 0 ? data.playersToday : FALLBACK_STATS.playersToday,
        streakLeaders: data.streakLeaders > 0 ? data.streakLeaders : FALLBACK_STATS.streakLeaders,
      }))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans">
      <LandingHeader onPlay={goToGame} user={user} setLocation={setLocation} />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.p variants={fadeUp} className="text-sm font-bold text-primary uppercase tracking-widest mb-5 font-mono">
              Musicathon 2026 · Daily Music Challenge
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-6">
              The guessing game<br />for{" "}
              <span className="text-primary">real fans</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-gray-500 leading-relaxed mb-8 max-w-md">
              Five clues. One song. Create your own puzzles, challenge friends, and climb the global leaderboard.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={goToGame}
                className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 rounded-full text-base gap-2 shadow-lg shadow-primary/25"
              >
                Play Today's Puzzle <ArrowRight className="w-4 h-4" />
              </Button>
              {!user && (
                <Button size="lg" variant="outline" onClick={() => setLocation("/sign-up")} className="h-12 rounded-full font-semibold px-8">
                  Sign up free
                </Button>
              )}
            </motion.div>
          </motion.div>

          <MockPuzzleCard />
        </div>
      </section>

      {/* ── Partner strip ──────────────────────────────────────────────── */}
      <section className="py-10 border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Powered by the music platforms you love
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {["Spotify", "Apple Music", "YouTube Music", "Amazon Music", "TIDAL"].map((name) => (
              <span key={name} className="text-sm font-bold text-gray-300 tracking-tight hover:text-gray-400 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-b border-gray-100">
        <motion.div
          ref={statsRef}
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:divide-x divide-gray-100"
        >
          {[
            { value: stats.totalCompletions, suffix: "+", label: "Puzzles Solved", sub: "and counting" },
            { value: stats.playersToday, suffix: "", label: "Players Today", sub: "across 80+ countries" },
            { value: stats.streakLeaders, suffix: "", label: "Streak Leaders", sub: "see the leaderboard →", href: `${basePath}/leaderboard` },
          ].map(({ value, suffix, label, sub, href }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className={`flex flex-col items-center text-center sm:px-8 gap-1 ${href ? "cursor-pointer group" : ""}`}
              onClick={href ? () => setLocation(href!) : undefined}
            >
              <span className="font-serif font-black text-4xl sm:text-5xl text-primary">
                <CountUp target={value} suffix={suffix} started={inView} />
              </span>
              <span className="font-semibold text-gray-900 text-sm tracking-wide uppercase">{label}</span>
              <span className={`text-xs font-mono ${href ? "text-primary group-hover:underline" : "text-gray-400"}`}>{sub}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-3">More than just a daily puzzle</h2>
            <p className="text-gray-500 text-lg">Create, compete, and connect through music.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-4 p-6 bg-white border border-gray-200 rounded-2xl hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1 text-base">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 text-lg">Start playing in seconds.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary text-white font-black text-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25 font-mono">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-primary rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-white/10" />
            </div>
            <div className="relative z-10">
              <p className="text-white/80 font-semibold uppercase tracking-widest text-sm mb-4 font-mono">Ready to play?</p>
              <h2 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                Today's puzzle is waiting for you
              </h2>
              <p className="text-white/80 text-lg mb-8">
                New song every day at midnight. Share your result. Climb the leaderboard.
              </p>
              <Button size="lg" onClick={goToGame} className="bg-white text-primary hover:bg-white/90 font-bold h-12 px-10 rounded-full text-base gap-2">
                Play Now <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} alt="Lyricle" className="w-6 h-6" />
            <span className="font-black text-lg text-primary tracking-tight">LYRICLE</span>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-sm text-gray-400">© 2026 Lyricle · Made for Musicathon 2026</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Made by{" "}
              <a href="https://mikaships.site" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
                mikacend
              </a>
              {" "}(mikaships.site)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
