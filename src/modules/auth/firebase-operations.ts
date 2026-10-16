import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile, validatePassword, type Auth,
} from "firebase/auth";
import { AuthFlowError, providerCode } from "./errors";
import { registrationSchema } from "./validation";

/** Provider operations also run against the real Auth Emulator in integration tests. */
export async function verifiedSignInToken(auth: Auth, email: string, password: string): Promise<string> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  if (!user.emailVerified) throw new AuthFlowError("EMAIL_NOT_VERIFIED", "Verify your email address before signing in. Need another email? Use the verification link below.");
  return user.getIdToken(true);
}

export async function registerAccount(auth: Auth, input: { fullName: string; email: string; password: string }, continueUrl: string): Promise<void> {
  const values = registrationSchema.parse(input);
  let created = false;
  try {
    // The official emulator does not implement getPasswordPolicy. Local Zod
    // requirements still apply; hosted Firebase always validates its policy.
    const policy = auth.emulatorConfig ? null : await validatePassword(auth, values.password);
    if (policy && !policy.isValid) {
      const requirements = policy.passwordPolicy.customStrengthOptions;
      const missing = [
        policy.meetsMinPasswordLength === false ? `at least ${requirements.minPasswordLength ?? 8} characters` : null,
        policy.containsLowercaseLetter === false ? "a lowercase letter" : null,
        policy.containsUppercaseLetter === false ? "an uppercase letter" : null,
        policy.containsNumericCharacter === false ? "a number" : null,
        policy.containsNonAlphanumericCharacter === false ? "a symbol" : null,
      ].filter(Boolean);
      throw new AuthFlowError("PASSWORD_POLICY", missing.length ? `Your password needs ${missing.join(", ")}.` : "Your password does not meet the account password policy.");
    }
    const { user } = await createUserWithEmailAndPassword(auth, values.email, values.password);
    created = true;
    // Full name belongs to Firebase identity metadata. No database/profile or role is created.
    await updateProfile(user, { displayName: values.fullName });
    await sendEmailVerification(user, { url: continueUrl });
  } catch (error) {
    if (created) throw new AuthFlowError("ACCOUNT_SETUP_INCOMPLETE", "Your account was created, but setup could not finish. Open email verification below and sign in there to resend the verification email.");
    throw error;
  } finally { await signOut(auth); }
}

export async function resendAccountVerification(auth: Auth, email: string, password: string, continueUrl: string): Promise<void> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (user.emailVerified) throw new AuthFlowError("ALREADY_VERIFIED", "Your email is already verified. Return to login to open your workspace.");
    await sendEmailVerification(user, { url: continueUrl });
  } finally { await signOut(auth); }
}

export async function requestPasswordReset(auth: Auth, email: string, continueUrl: string): Promise<void> {
  try { await sendPasswordResetEmail(auth, email, { url: continueUrl }); }
  catch (error) {
    if (providerCode(error) !== "auth/user-not-found") throw error;
  }
}
