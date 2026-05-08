import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-4xl font-bold">Founder Match</h1>
      <p className="mt-4 text-slate-300">AI-selected high-value founder and investor introductions.</p>
      <div className="mt-8 flex gap-4">
        <Link className="rounded bg-blue-600 px-4 py-2" href="/register">Register</Link>
        <Link className="rounded border border-slate-600 px-4 py-2" href="/login">Login</Link>
      </div>
    </main>
  );
}
