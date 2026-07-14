import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the dig talent intelligence workspace.",
};

interface LoginPageProps {
  searchParams: Promise<{ setup?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { setup } = await searchParams;

  return (
    <main className="grid min-h-svh grid-cols-[minmax(0,1fr)] bg-surface lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-[#1f1f1d] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "linear-gradient(to bottom right, black, transparent 78%)",
          }}
        />
        <div className="relative flex items-baseline gap-4">
          <span className="text-5xl font-medium tracking-[-0.08em]">dig</span>
          <span className="text-[10px] tracking-[0.2em] text-white/45 uppercase">
            by Curiosity
          </span>
        </div>
        <div className="relative max-w-3xl">
          <p className="mb-7 text-[11px] font-medium tracking-[0.2em] text-white/45 uppercase">
            Global CG talent intelligence
          </p>
          <h1 className="text-5xl leading-[1.05] font-normal tracking-[-0.055em] xl:text-7xl">
            Find the people behind exceptional spaces.
          </h1>
          <p className="mt-8 max-w-xl text-sm leading-7 text-white/50">
            A focused recruiting workspace for architectural visualization,
            interiors, luxury retail and hospitality talent worldwide.
          </p>
        </div>
        <p className="relative text-[10px] tracking-[0.12em] text-white/30 uppercase">
          Private &amp; confidential
        </p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-6 py-14 sm:px-10">
        <div className="min-w-0 w-full max-w-[390px]">
          <div className="mb-12 flex items-baseline gap-3 lg:hidden">
            <span className="text-4xl font-medium tracking-[-0.08em]">dig</span>
            <span className="text-[9px] tracking-[0.18em] text-muted uppercase">by Curiosity</span>
          </div>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
            Talent intelligence workspace
          </p>
          <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">Welcome back.</h2>
          <p className="mb-9 mt-3 text-sm leading-6 text-muted">
            Sign in to discover, evaluate and manage global CG talent.
          </p>
          {setup === "missing" ? (
            <p className="mb-5 rounded-lg border border-[#ddc9a7] bg-[#f5efe4] px-3 py-2.5 text-xs leading-5 text-[#745e39]">
              This workspace has not been connected to Supabase yet. Ask an
              administrator to complete the environment setup.
            </p>
          ) : null}
          <LoginForm />
          <p className="mt-10 text-center text-[11px] leading-5 text-[#99978f]">
            Access is limited to invited Curiosity team members.
          </p>
        </div>
      </section>
    </main>
  );
}
