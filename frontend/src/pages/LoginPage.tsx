/** Sign-in screen — the only door into `/app`. */

import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { AuthLayout } from "@/pages/AuthLayout";
import { Field, TextInput, Button } from "@/components/ui/Primitives";
import { ErrorNotice } from "@/components/ui/Primitives";
import { useSession } from "@/app/useSession";
import { describeAuthError } from "@/app/authErrors";

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where the visitor was headed before the session guard stepped in.
  const from =
    (location.state as { from?: string } | null)?.from ?? "/app/overview";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (username === "" || password === "") {
      setError("Enter both a username and a password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await session.signIn(username, password);
      navigate(from, { replace: true });
    } catch (cause: unknown) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your organizations, authorized scopes and the security activity trail."
      footer={
        <>
          No account yet?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
        {error !== null && <ErrorNotice title={error} />}
        <Field label="Username" htmlFor="login-username">
          <TextInput
            id="login-username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            spellCheck={false}
            placeholder="your-username"
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <TextInput
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" disabled={busy} className="mt-1 w-full">
          {busy ? (
            "Signing in…"
          ) : (
            <>
              <LogIn size={15} aria-hidden />
              Sign in
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
