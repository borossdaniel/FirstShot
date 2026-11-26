import * as v from "valibot";

export const SignupSchema = v.object({
  email: v.pipe(v.string(), v.email("Enter a valid email address")),
  password: v.pipe(
    v.string(),
    v.minLength(8, "Password must be at least 8 characters"),
  ),
  newsletter: v.optional(v.boolean(), false),
});

export function parseSignup(input) {
  const result = v.safeParse(SignupSchema, input);

  if (result.success) {
    return { ok: true, value: result.output };
  }

  const { nested } = v.flatten(result.issues);
  return { ok: false, errors: nested ?? {} };
}
