"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { fieldControlClass } from "@/components/ui/field";
import { buttonStyles } from "@/components/ui/button";

function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonStyles("primary", "mt-2 h-12 w-full justify-between px-4")}
    >
      <span>{pending ? "Signing in…" : "Sign in"}</span>
      <ArrowRight size={16} />
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-xs font-medium text-[#55544f]">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@curiosity.jp"
          className={fieldControlClass}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-medium text-[#55544f]">
            Password
          </label>
          <span className="text-[11px] text-[#9a9890]">Secure workspace</span>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          placeholder="Enter your password"
          className={fieldControlClass}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-[#f3e8e6] px-3 py-2.5 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      <SignInButton />
    </form>
  );
}
