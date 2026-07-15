export const metadata = { title: "Offline — Ctrl+P" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <img src="/icons/icon-192.png" alt="Ctrl+P" className="mb-6 h-16 w-16 rounded-2xl" />
      <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        The Ctrl+P app can&apos;t reach the network right now. Check your connection and try again.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
      >
        Retry
      </a>
    </main>
  );
}
