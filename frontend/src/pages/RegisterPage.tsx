/** Account creation screen. */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { AuthLayout } from "@/pages/AuthLayout";
import { Field, TextInput, Button, ErrorNotice } from "@/components/ui/Primitives";
import { useSession } from "@/app/useSession";
import { describeAuthError } from "@/app/authErrors";

export function RegisterPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    // Client-side mirrors of the backend contract — real validation, not
    // decoration: failures here never produce a request that must fail twice.
    if (username.length < 3) {
      setProblem("Usernames need at least 3 characters.");
      return;
    }
    if (password.length < 8) {
      setProblem("Passwords need at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setProblem("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setProblem(null);
    try {
      const payload: { username: string; email?: string; password: string } = {
        username,
        password,
      };
      if (email !== "") payload.email = email;
      await session.signUp(payload);
      navigate("/app/overview", { replace: true });
    } catch (cause: unknown) {
      setProblem(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Registration is self-serve. Your account becomes the owner of its own organization, ready to authorize scope."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="register-form">
        {problem !== null && <ErrorNotice title={problem} />}
        <Field label="Username" htmlFor="register-username" hint="3–100 characters, unique across the platform.">
          <TextInput
            id="register-username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            minLength={3}
            spellCheck={false}
            placeholder="your-username"
          />
        </Field>
        <Field label="Email (optional)" htmlFor="register-email">
          <TextInput
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="register-password" hint="Minimum 8 characters.">
          <TextInput
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Confirm password" htmlFor="register-confirm">
          <TextInput
            id="register-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" disabled={busy} className="mt-1 w-full">
          {busy ? (
            "Creating account…"
          ) : (
            <>
              <UserPlus size={15} aria-hidden />
              Create account
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
