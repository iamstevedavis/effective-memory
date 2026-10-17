import { redirect } from "next/navigation";

// The old import screen was split into Reviews and Brand.
export default function ImportPage() { redirect("/reviews"); }
