"use client";
import { signIn, signOut } from "next-auth/react";
export default function Account() { return <nav aria-label="Account"><button onClick={() => signIn("github")}>Sign in with GitHub</button> <button onClick={() => signOut()}>Sign out</button></nav>; }
