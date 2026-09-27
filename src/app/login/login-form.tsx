"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/client/api";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(password);
      window.location.href = next;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインに失敗しました");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="password">パスワード</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || !password}>
        {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
        ログイン
      </Button>
    </form>
  );
}
