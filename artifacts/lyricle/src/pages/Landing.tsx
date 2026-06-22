import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthUser } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, Music2, Ticket, Settings2, Play, Search, Disc3 } from "lucide-react";
import Header from "@/components/Header";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user } = useAuthUser();

  const goToPlay = () => setLocation("/game");
  const goToCreate = () => setLocation(user ? "/create" : "/sign-up");
  const goToLeaderboard = () => setLocation("/leaderboard");

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Mockup state
  const [mockupStep, setMockupStep] = useState(1);
  const [mockInput, setMockInput] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const handleMockSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!mockInput.trim() || isShaking) return;
    
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setMockInput("");
      setMockupStep(prev => prev < 3 ? prev + 1 : 1);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-primary selection:text-white font-sans">
      <Header />

      {/* Trust Bar */}
      <div className="w-full bg-slate-50 text-slate-500 py-3 px-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 border-b border-slate-200 text-center">
        <span>Daily puzzles updated midnight.</span>
        <span className="hidden sm:inline text-slate-300">///</span>
        <span>Data by Musixmatch, Songstats & JamBase.</span>
      </div>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 lg:gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-6xl md:text-[5.5rem] lg:text-[6.5rem] font-serif font-black tracking-tighter leading-[0.9] mb-8 text-slate-900">
              Guess the song.<br/>Challenge your friends.
            </h1>
            <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed max-w-lg mb-10">
              Play the daily music puzzle — or create your own and send it to friends. Completely free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={goToPlay}
                className="group inline-flex items-center justify-center bg-slate-900 text-white font-bold text-base md:text-lg px-8 py-4 rounded-full hover:scale-105 transition-transform"
              >
                Play for Free
                <Play className="ml-3 w-5 h-5 fill-current" />
              </button>
              <button 
                onClick={goToCreate}
                className="group inline-flex items-center justify-center bg-transparent border-2 border-slate-200 text-slate-700 font-bold text-base md:text-lg px-8 py-4 rounded-full hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Create a Puzzle
              </button>
            </div>
          </motion.div>

          {/* Replit-style Abstract Hero Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative lg:ml-auto w-full max-w-lg"
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-orange-100 to-blue-50 opacity-50 blur-2xl rounded-3xl -z-10" />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 relative">
              {/* Fake Window Controls */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Lyricle #1247
                </div>
              </div>

              {/* Fake Game UI */}
              <div className="space-y-8">
                {/* Stage 1 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Stage 1 • Creator's Clue
                  </div>
                  <p className="font-serif italic text-lg text-slate-600 transition-all">"This song defined my entire summer of '09"</p>
                </div>

                {/* Stage 2 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Stage 2 • Vibes & Themes
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-[#FFF3EB] text-[#C23A00] font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">#nostalgia</span>
                    <span className="bg-[#FFF3EB] text-[#C23A00] font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">#summer</span>
                    <span className="bg-[#FFF3EB] text-[#C23A00] font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full hidden sm:inline">#heartbreak</span>
                  </div>
                </div>

                {/* Stage 3 (Revealed after guess) */}
                <AnimatePresence>
                  {mockupStep > 1 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Stage 3 • Lyrics Snippet
                      </div>
                      <p className="font-serif italic text-lg text-slate-600">"♪ Summer nights and city lights..."</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4">
                  <form onSubmit={handleMockSubmit} className="relative">
                    <motion.input
                      animate={isShaking ? { x: [-5, 5, -5, 5, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      type="text"
                      value={mockInput}
                      onChange={(e) => setMockInput(e.target.value)}
                      placeholder="Type artist & song..."
                      className={`h-12 w-full bg-slate-50 border ${isShaking ? 'border-red-400 text-red-500' : 'border-slate-200 text-slate-700'} rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-primary transition-colors`}
                    />
                    <button 
                      type="submit"
                      disabled={isShaking || !mockInput.trim()}
                      className="absolute right-1.5 top-1.5 w-9 h-9 bg-primary hover:bg-[#E64500] disabled:bg-slate-300 rounded-lg flex items-center justify-center text-white transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                  <div className="flex gap-1 mt-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div 
                        key={i} 
                        className={`h-1 w-full rounded-full transition-colors ${i < mockupStep ? 'bg-red-400' : i === mockupStep ? 'bg-primary' : 'bg-slate-200'}`} 
                      />
                    ))}
                  </div>
                  <div className="text-center font-mono text-[9px] uppercase tracking-widest text-slate-400 mt-2 font-bold">
                    {6 - mockupStep} guesses remaining
                  </div>
                </div>
              </div>
            </div>
            
            {/* Soft decorative shadow behind */}
            <div className="absolute top-12 left-6 right-6 h-full bg-[#FFF3EB] rounded-2xl -z-20 border border-orange-100" />
          </motion.div>
        </div>
      </section>

      {/* Problem Section (Immersive Typographic Break in Light Mode) */}
      <section className="py-24 md:py-32 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-4xl md:text-5xl lg:text-7xl font-serif font-black leading-[1.05] tracking-tighter text-slate-900"
          >
            STATIC LYRICS SITES ARE BORING. AND STANDARD MUSIC QUIZZES GET REPETITIVE.
          </motion.h2>
          <div className="mt-12 md:mt-16 max-w-2xl border-l-4 border-primary pl-6 md:pl-10">
            <p className="text-lg md:text-2xl text-slate-600 font-medium leading-relaxed">
              Most games only test your speed on audio clips, meaning you cannot play them on a quiet commute. On top of that, these trivia games are disconnected from the music itself, leaving you to search elsewhere to find out if the artist is touring or how the song is performing.
            </p>
          </div>
        </div>
      </section>

      {/* Solution / Features (Bento Grid) */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-[10px] font-mono text-slate-400 font-bold tracking-[0.2em] uppercase mb-4">The Solution</h2>
            <p className="text-3xl md:text-5xl font-serif font-bold text-slate-900 max-w-4xl leading-[1.1] tracking-tight">
              Lyricle is a text-first music guessing game that connects trivia directly to live concert listings and streaming charts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-8">
                <Search className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-black text-slate-900 mb-4 tracking-tight">Step-by-Step Clues</h3>
              <p className="text-slate-500 leading-relaxed font-medium">Play without sound by reading step-by-step clues, checking the album art, and listening to the audio preview only if you get stuck.</p>
            </div>
            
            <div className="bg-[#FFF3EB] border border-orange-100 rounded-2xl p-8 md:p-10 shadow-sm relative overflow-hidden">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-8 shadow-sm">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-black text-slate-900 mb-4 tracking-tight">Real-Time Touring</h3>
              <p className="text-[#C23A00] leading-relaxed font-medium relative z-10">Real-time tour ticket links and streaming stats shown immediately on the results screen.</p>
              <Ticket className="w-64 h-64 text-orange-200/50 absolute -bottom-16 -right-16 -rotate-12 pointer-events-none" />
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-10 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-8">
                <Settings2 className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-black text-slate-900 mb-4 tracking-tight">Custom Puzzles</h3>
              <p className="text-slate-500 leading-relaxed font-medium">Custom puzzle creators so you can build personal music challenges for your friends.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works (Vertical Stagger) */}
      <section className="py-32 px-6 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-serif font-black text-center mb-24 tracking-tighter text-slate-900">HOW IT WORKS</h2>
          
          <div className="space-y-16 md:space-y-24 relative">
            {/* Tracking line */}
            <div className="absolute left-8 md:left-12 top-0 bottom-0 w-px bg-slate-100 -z-10 hidden sm:block" />

            {[
              { num: "01", title: "Start with the creator's personal clue and enter your first guess." },
              { num: "02", title: "Unlock clues with each incorrect guess. The game guides you through Vibes & Themes, a Lyric Snippet, the Album Art, and finally an Audio Preview." },
              { num: "03", title: "Find the song. Use our autocomplete search box to select the artist or song title. You have 5 guesses total." }
            ].map((step, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex flex-col sm:flex-row gap-6 sm:gap-12 md:gap-16 items-start"
              >
                <div className="text-5xl md:text-7xl font-serif font-black text-primary leading-none select-none tracking-tighter shrink-0 bg-white sm:py-2">
                  {step.num}
                </div>
                <div className="pt-2 sm:pt-4">
                  <p className="text-xl md:text-3xl font-serif font-bold leading-snug text-slate-800 tracking-tight">
                    {step.title}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-32 px-6 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 relative z-10">
          <div>
            <div className="text-primary mb-6"><Disc3 className="w-10 h-10" /></div>
            <p className="text-2xl md:text-4xl font-serif font-medium text-white mb-10 leading-snug tracking-tight">
              I play this with my coworkers in a group chat every single morning. It is a fun routine.
            </p>
            <div className="font-mono text-xs font-bold tracking-widest text-slate-400 uppercase">— Sarah K., Play Tester</div>
          </div>
          <div>
            <div className="text-primary mb-6"><Settings2 className="w-10 h-10" /></div>
            <p className="text-2xl md:text-4xl font-serif font-medium text-white mb-10 leading-snug tracking-tight">
              Making my own custom puzzles to quiz my friends is addictive. We have a running leaderboard.
            </p>
            <div className="font-mono text-xs font-bold tracking-widest text-slate-400 uppercase">— Marcus L., Beta Player</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-serif font-black mb-16 tracking-tighter text-center text-slate-900">FAQ</h2>
          <div className="border-t border-slate-200">
            {[
              { q: "Do I need an account to play?", a: "No. Anyone can visit the site and play the daily game immediately. You only need a free account if you want to track stats or build your own puzzles." },
              { q: "Where does the song database come from?", a: "We fetch lyrics and theme tags from Musixmatch, concert listings and ticket links from JamBase, and streaming and popularity metrics from Songstats." },
              { q: "Can I create a puzzle using any song?", a: "Yes. You can search our database of millions of songs to build custom challenges." }
            ].map((faq, i) => (
              <div key={i} className="border-b border-slate-200 bg-white">
                <button 
                  className="w-full text-left py-8 flex justify-between items-center hover:text-primary transition-colors group"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-lg md:text-xl font-bold pr-8 text-slate-900 group-hover:text-primary transition-colors">{faq.q}</span>
                  <ChevronDown className={`w-6 h-6 text-slate-400 flex-shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-8 text-slate-500 font-medium text-base md:text-lg leading-relaxed pr-8 md:pr-12">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-40 px-6 bg-slate-50 text-center flex flex-col items-center justify-center border-t border-slate-200">
        <h2 className="text-5xl md:text-7xl font-serif font-black text-slate-900 mb-12 tracking-tighter max-w-4xl leading-[1.05]">
          A NEW WAY TO EXPERIENCE MUSIC TRIVIA.
        </h2>
        <button 
          onClick={goToPlay}
          className="bg-primary text-white font-bold text-lg md:text-xl px-12 md:px-14 py-5 rounded-full hover:bg-[#E64500] hover:scale-105 transition-all shadow-lg shadow-orange-500/20"
        >
          Start today's puzzle
        </button>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white text-center md:text-left flex flex-col justify-between items-center gap-8 border-t border-slate-200">
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-serif font-black text-2xl tracking-tight text-primary">LYRICLE</div>
          <div className="flex flex-wrap justify-center gap-6 font-mono font-bold text-[10px] md:text-xs uppercase tracking-widest text-slate-400">
            <button onClick={() => setLocation("/")} className="hover:text-slate-900 transition-colors">Home</button>
            <button onClick={goToLeaderboard} className="hover:text-slate-900 transition-colors">Leaderboard</button>
            <button onClick={goToCreate} className="hover:text-slate-900 transition-colors">Create</button>
          </div>
          <div className="text-slate-400 font-medium text-xs">
            © {new Date().getFullYear()} Lyricle.<br className="md:hidden" /> Made by mikacend.
          </div>
        </div>
      </footer>
    </div>
  );
}

