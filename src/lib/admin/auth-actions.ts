"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").slice(0, 128);
  try {
    await signIn("credentials", {
      username,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/admin/posts",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? (error as { code?: string }).code : undefined;
      return {
        username, // react resets the form, keep the username
        error:
          code === "rate_limited"
            ? "Too many attempts. Try again in 15 minutes."
            : "That username and password don’t match.",
      };
    }
    throw error; // let next handle the redirect
  }
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
