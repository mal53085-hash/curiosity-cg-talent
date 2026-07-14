"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CONFIG_ERROR } from "@/lib/supabase/config";

export type LoginState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Enter a valid email and password." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Incorrect email or password." };
  } catch (error) {
    return {
      error: error instanceof Error && error.message === CONFIG_ERROR
        ? "Workspace setup is incomplete. Contact your administrator."
        : "Unable to sign in right now. Please try again.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
