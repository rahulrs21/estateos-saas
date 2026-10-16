"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const label = props.id === "confirmPassword" ? "confirmation password" : "password";
  return <div className="relative">
    <Input autoCapitalize="none" spellCheck={false} {...props} type={visible ? "text" : "password"} className="h-11 pr-12" />
    <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-1 -translate-y-1/2" onClick={() => setVisible(!visible)} aria-label={`${visible ? "Hide" : "Show"} ${label}`} aria-pressed={visible} aria-controls={props.id}>
      {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </Button>
  </div>;
}
