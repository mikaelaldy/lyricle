import { useState } from "react";
import { MessageSquarePlus, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPlayerData } from "@/lib/storage";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) {
  return `${basePath}/api${path}`;
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const reset = () => {
    setMessage("");
    setEmail("");
    setStatus("idle");
  };

  const handleSubmit = async () => {
    if (message.trim().length < 2) return;
    setStatus("sending");
    try {
      const res = await fetch(apiUrl("/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim() || undefined,
          context: window.location.pathname,
          playerId: getPlayerData().playerId,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("sent");
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1600);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        title="Send feedback"
        data-testid="button-feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] font-black">Send us feedback</DialogTitle>
            <DialogDescription>
              Found a bug or have an idea? We'd love to hear it — no account needed.
            </DialogDescription>
          </DialogHeader>

          {status === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-semibold">Thanks for your feedback!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message">Your feedback</Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  maxLength={2000}
                  data-testid="input-feedback-message"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-email">Email (optional)</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com — if you'd like a reply"
                  data-testid="input-feedback-email"
                />
              </div>
              {status === "error" && (
                <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={message.trim().length < 2 || status === "sending"}
                className="w-full rounded-full font-bold"
                data-testid="button-feedback-submit"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send feedback
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
