import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>hello</h1>
      <p>effective-memory scaffold is up.</p>
      <ul>
        <li><Link href="/import">Manual review CSV import</Link></li>
        <li><Link href="/quotes">Quote selector v1</Link></li>
      </ul>
    </main>
  );
}
