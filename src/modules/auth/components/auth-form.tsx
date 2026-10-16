"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { authErrorMessage, loginWithEmail, resetPassword, resendVerification, signupWithEmail } from "@/modules/auth/client";
import { loginSchema, resetPasswordSchema, signupSchema, type AuthFormMode } from "@/modules/auth/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const labels = { login: "Log in", signup: "Create account", reset: "Send reset email", verify: "Resend verification email" };

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [signupComplete, setSignupComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null); setMessage(null); setFieldErrors({});
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = { email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? ""), confirmPassword: String(data.get("confirmPassword") ?? "") };
    const schema = mode === "signup" ? signupSchema : mode === "reset" ? resetPasswordSchema : loginSchema;
    const validation = schema.safeParse(values);
    if (!validation.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of validation.error.issues) {
        const key = String(issue.path[0] ?? "form");
        (fields[key] ??= []).push(issue.message);
      }
      setFieldErrors(fields); setError("Please check the highlighted fields.");
      return;
    }
    setPending(true);
    try {
      if (mode === "login") {
        await loginWithEmail(values.email, values.password);
        // Full navigation discards any previously cached signed-in route tree.
        window.location.replace("/workspace/dashboard");
        return;
      }
      if (mode === "signup") {
        await signupWithEmail(values.email, values.password);
        setSignupComplete(true);
        setMessage("Your account was created. Check your inbox for the verification email, follow its link, then return here to log in.");
      } else if (mode === "verify") {
        await resendVerification(values.email, values.password);
        setMessage("Verification email sent. Check your inbox and spam folder, follow its link, then return to login.");
      } else {
        await resetPassword(values.email);
        setMessage("If an account exists for this email address, you’ll receive password reset instructions. Check your inbox and spam folder.");
      }
      form.reset();
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { setPending(false); }
  }

  return (
    <div className="mt-7">
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6 text-destructive">{error}</div>}
      {message && <div role="status" className="mb-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><p>{message}</p></div>}
      {!signupComplete && <form onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-5">
          <legend className="sr-only">{labels[mode]}</legend>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@agency.com" className="h-11" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
            {fieldErrors.email && <p id="email-error" className="text-xs text-destructive">{fieldErrors.email[0]}</p>}
          </div>
          {mode !== "reset" && <div className="space-y-2">
            <div className="flex items-center justify-between gap-3"><Label htmlFor="password">Password</Label>{mode === "login" && <Link href="/forgot-password" className="rounded text-xs font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>}</div>
            <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required maxLength={4096} placeholder={mode === "signup" ? "Choose a strong password" : "Enter your password"} className="h-11" aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? "password-error" : mode === "signup" ? "password-help" : undefined} />
            {mode === "signup" && <p id="password-help" className="text-xs leading-5 text-muted-foreground">Use at least 8 characters. You may also need uppercase and lowercase letters, numbers, or symbols.</p>}
            {fieldErrors.password && <p id="password-error" className="text-xs text-destructive">{fieldErrors.password[0]}</p>}
          </div>}
          {mode === "signup" && <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={4096} placeholder="Re-enter your password" className="h-11" aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined} />
            {fieldErrors.confirmPassword && <p id="confirm-error" className="text-xs text-destructive">{fieldErrors.confirmPassword[0]}</p>}
          </div>}
          <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Please wait…</> : <>{labels[mode]}<ArrowRight className="size-4" aria-hidden="true" /></>}</Button>
        </fieldset>
      </form>}
      <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs">
        {mode !== "login" && <Link href="/login" className="rounded font-medium text-primary underline-offset-4 hover:underline">Back to login</Link>}
        {mode !== "verify" && <Link href="/verify-email" className="rounded font-medium text-primary underline-offset-4 hover:underline">Email verification</Link>}
        {mode === "verify" && <Link href="/forgot-password" className="rounded font-medium text-primary underline-offset-4 hover:underline">Reset password</Link>}
      </div>
    </div>
  );
}
