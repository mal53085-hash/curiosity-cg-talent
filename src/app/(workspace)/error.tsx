"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceErrorProps {
  reset: () => void;
}

export default function WorkspaceError({ reset }: WorkspaceErrorProps) {
  return (
    <div className="grid min-h-[70svh] place-items-center px-6 py-20 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#f0e5e3] text-danger">
          <AlertTriangle size={19} />
        </div>
        <h1 className="mt-5 text-2xl font-medium tracking-[-0.03em]">データを読み込めませんでした</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          接続設定またはネットワークを確認して、もう一度お試しください。
        </p>
        <Button type="button" variant="secondary" onClick={reset} className="mt-6">
          再試行
        </Button>
      </div>
    </div>
  );
}
