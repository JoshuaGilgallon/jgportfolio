import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { safeEqual, verifyPassword } from "@/lib/password";
import { allowSignInAttempt, clearSignInAttempts } from "@/lib/rate-limit";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const credentialsSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(512),
});

// dummy hash so failed logins take the same time
const DUMMY_HASH =
  "scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw, request) {
        const ip = clientIp(request);
        if (!allowSignInAttempt(ip)) throw new RateLimited();

        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const username = process.env.ADMIN_USERNAME ?? "";
        const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
        if (!username || !hash) {
          console.warn("[auth] ADMIN_USERNAME / ADMIN_PASSWORD_HASH are not set.");
        }

        // always verify so timing doesn't leak anything
        const passwordOk = await verifyPassword(parsed.data.password, hash || DUMMY_HASH);
        const usernameOk = username !== "" && safeEqual(parsed.data.username, username);
        if (!passwordOk || !usernameOk || !hash) return null;

        clearSignInAttempts(ip);
        return { id: "admin", name: "Josh" };
      },
    }),
  ],
});
