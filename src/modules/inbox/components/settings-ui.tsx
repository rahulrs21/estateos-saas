"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { errorMessage } from "@/modules/communications/client";
import { LeadFormMessage } from "@/modules/leads/components/lead-ui";

/* Shared building blocks of the inbox settings page. */

export function Section({title, description, action, children}: {title: string; description: ReactNode; action?: ReactNode; children: ReactNode}) {
  return <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><CardTitle role="heading" aria-level={2}>{title}</CardTitle><CardDescription>{description}</CardDescription></div>{action}</div></CardHeader><CardContent className="px-5">{children}</CardContent></Card>;
}

export function FormDialog({trigger, title, description, submitLabel, children, onSubmit}: {trigger: ReactNode; title: string; description: string; submitLabel: string; children: ReactNode; onSubmit: (form: FormData) => Promise<boolean>}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try { if (await onSubmit(new FormData(event.currentTarget))) setOpen(false); }
    catch (problem) { setError(errorMessage(problem, "The change could not be saved.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{children}<Button type="submit">{pending ? "Saving…" : submitLabel}</Button></fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

export const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
