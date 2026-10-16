import { z } from "zod";

const email = z.email("Enter a valid email address.").max(254).transform((value) => value.trim());
const password = z.string().min(1, "Enter your password.").max(4096, "Your password is too long.");

export const loginSchema = z.object({ email, password });
export const resetPasswordSchema = z.object({ email });
export const signupSchema = loginSchema.extend({
  password: password.min(8, "Choose a password with at least 8 characters."),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Your passwords do not match.", path: ["confirmPassword"],
});

export type AuthFormMode = "login" | "signup" | "reset" | "verify";
