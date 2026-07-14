"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCandidateAction } from "@/app/actions/candidates";
import { Button } from "@/components/ui/button";

interface DeleteCandidateButtonProps {
  candidateId: string;
  candidateName: string;
}

export function DeleteCandidateButton({ candidateId, candidateName }: DeleteCandidateButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const handleDelete = () => {
    if (!window.confirm(`${candidateName} を削除します。この操作は取り消せません。`)) return;
    setError(undefined);
    startTransition(async () => {
      try {
        await deleteCandidateAction(candidateId);
      } catch {
        setError("削除できませんでした。時間をおいて再度お試しください。");
      }
    });
  };

  return (
    <div>
      <Button type="button" variant="danger" onClick={handleDelete} disabled={pending} className="w-full sm:w-auto">
        <Trash2 size={15} />
        {pending ? "削除中…" : "候補者を削除"}
      </Button>
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
