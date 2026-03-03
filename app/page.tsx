import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>hello</h1>
      <p>effective-memory scaffold is up.</p>
      <p>
        <Link href="/import">Go to manual review CSV import</Link>
      </p>
    </main>
  );
}
