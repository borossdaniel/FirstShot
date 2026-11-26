// Pre-1.0 Valibot API (validations as an array instead of pipe()).
import { object, string, email, minLength, optional, boolean, safeParse, flatten } from 'valibot';

export const SignupSchema = object({
  email: string([email('Enter a valid email address')]),
  password: string([minLength(8, 'Password must be at least 8 characters')]),
  newsletter: optional(boolean(), false),
});

export function parseSignup(input) {
  const result = safeParse(SignupSchema, input);
  if (result.success) return { ok: true, value: result.output };
  return { ok: false, errors: flatten(result.issues).nested };
}
