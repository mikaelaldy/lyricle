import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as any } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

function LandingHeader({ user, setLocation }: { user: any; setLocation: (p: string) => void }) {
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
              <Button size="sm" onClick={() => setLocation("/sign-up")} className="rounded-full font-bold px-5 bg-primary text-white hover:bg-primary/90 shadow-sm">
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

const HOW_TO_PLAY = [
  {
    step: "01",
    emoji: "🎯",
    title: "Start the Daily Puzzle",
    description: "A brand new song drops every day at midnight. Every player gets the exact same puzzle — it's a level playing field.",
  },
  {
    step: "02",
    emoji: "🧩",
    title: "Unlock Clues Stage by Stage",
    description: "Begin with Stage 1 — the creator's personal note about the song. Each wrong guess reveals a new, more direct clue.",
  },
  {
    step: "03",
    emoji: "✍️",
    title: "Type Your Guess",
    description: "Search for the artist & song title using the autocomplete box. You have 5 guesses total — use them wisely.",
  },
  {
    step: "04",
    emoji: "⏱️",
    title: "Race the Clock",
    description: "Your solve time is tracked. Guess it in fewer stages and faster to earn maximum points on the leaderboard.",
  },
  {
    step: "05",
    emoji: "🏆",
    title: "Share Your Score",
    description: "After you finish, share your result and see where you rank globally. Come back tomorrow for a new challenge.",
  },
];

const FEATURE_CARDS = [
  {
    emoji: "📈",
    title: "Earn Points & Climb the Ranks",
    description: "Every correct guess and every puzzle you create earns you points. Prove your elite music taste on the global leaderboard.",
  },
  {
    emoji: "🎫",
    title: "Catch Them Live",
    description: "Finished a puzzle? We'll instantly show you if that artist is touring near your city (Powered by JamBase).",
  },
  {
    emoji: "🌍",
    title: "Discover Global Trivia",
    description: "See real-time streaming stats and TikTok popularity for every song you play (Powered by Songstats).",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const goToPlay = () => setLocation(user ? "/game" : "/sign-up");
  const goToCreate = () => setLocation(user ? "/create" : "/sign-up");
  const goToLeaderboard = () => setLocation("/leaderboard");

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans">
      <LandingHeader user={user} setLocation={setLocation} />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-6">
              Guess the song.<br />Challenge your friends.
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-gray-500 leading-relaxed mb-8 max-w-md">
              Play the daily music puzzle — or create your own and send it to friends. Completely free.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={goToPlay}
                className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 h-12 rounded-full text-base transition-transform hover:scale-105 shadow-lg"
              >
                Play the Puzzle 🎵
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goToCreate}
                className="h-12 rounded-full font-semibold px-8 bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Create a Puzzle ✏️
              </Button>
            </motion.div>
          </motion.div>

          <MockPuzzleCard />
        </div>
      </section>

      {/* ── Trust / Partner Bar ─────────────────────────────────────── */}
      <section className="py-8 border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
            Powered by global music data:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {["Musixmatch Pro", "Songstats", "JamBase"].map((name) => (
              <span key={name} className="text-sm font-bold text-gray-300 tracking-tight hover:text-gray-400 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to Play Lyricle ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-4"
          >
            <h2 className="text-4xl font-black text-gray-900 mb-3">How to Play Lyricle</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Five stages. Five guesses. One song. A new puzzle every day.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex justify-center mb-10"
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation(user ? "/game" : "/sign-up")}
              className="rounded-full font-semibold px-5 border-primary/40 text-primary hover:bg-primary/5"
            >
              {user ? "Play the Puzzle →" : "Try it Free →"}
            </Button>
          </motion.div>

          <div className="space-y-4">
            {HOW_TO_PLAY.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg">{item.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-primary">STEP {item.step}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features & Benefits ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-black text-gray-900 mb-3">Features &amp; Benefits</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col p-7 bg-white border border-gray-200 rounded-3xl shadow-sm hover:shadow-lg hover:border-primary/20 transition-all"
              >
                <div className="text-3xl mb-4">{card.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">
                  {card.title} {card.emoji}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#f5f5f3]">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
              Ready to test your friends' music knowledge?
            </h2>
            <p className="text-lg text-gray-500 mb-8">
              No credit card required. Build your first custom puzzle in under 30 seconds.
            </p>
            <Button
              size="lg"
              onClick={goToCreate}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-10 h-12 rounded-full text-base transition-transform hover:scale-105 shadow-lg"
            >
              Start Creating Now
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-6 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} alt="Lyricle" className="w-6 h-6" />
            <span className="font-black text-lg text-primary tracking-tight">LYRICLE</span>
          </div>

          <nav className="flex items-center gap-6">
            <button onClick={() => setLocation("/")} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              Home
            </button>
            <button onClick={goToLeaderboard} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              Leaderboard
            </button>
            <button onClick={goToCreate} className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              Create
            </button>
          </nav>

          <p className="text-xs text-gray-400 text-center sm:text-right">
            Lyrics provided by Musixmatch Pro. Concert data by JamBase.
          </p>
        </div>
      </footer>
    </div>
  );
}
