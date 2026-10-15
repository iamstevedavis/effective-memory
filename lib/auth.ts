import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { authAdapter } from "./auth-adapter";
export const authOptions: NextAuthOptions = {
  adapter: authAdapter, secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "database", maxAge: 8 * 60 * 60 },
  providers: [GitHubProvider({ clientId: process.env.GITHUB_CLIENT_ID ?? "", clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "" })],
  logger: { error: code => console.error("auth_error", code), warn: code => console.warn("auth_warning", code), debug: () => {} }
};
export function authConfigured() { return !!(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET); }
