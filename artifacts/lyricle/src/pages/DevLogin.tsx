import { useEffect, useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DevLogin() {
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    async function signIn() {
      try {
        const res = await fetch("/api/dev-signin");
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const { ticket } = await res.json();
        window.location.href = `${window.location.origin}${basePath}/sign-in?__clerk_ticket=${ticket}`;
      } catch {
        setStatus("error");
      }
    }
    signIn();
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="text-5xl">🎵</div>

      {status === "loading" ? (
        <>
          <p className="text-lg font-semibold text-gray-700">Signing you in as test player…</p>
          <p className="text-sm text-gray-400">This only works in development mode.</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-red-500">Dev sign-in failed</p>
          <p className="text-sm text-gray-500 max-w-xs text-center">
            The API returned an error. Make sure the server is running and <code className="bg-gray-100 px-1 rounded">CLERK_SECRET_KEY</code> is set.
          </p>
        </>
      )}
    </div>
  );
}
