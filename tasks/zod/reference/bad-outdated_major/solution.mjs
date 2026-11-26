import { z } from 'zod';
export const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(13),
  tags: z.array(z.string()).default([]),
});
export function parseUser(input) {
  const r = UserSchema.safeParse(input);
  if (r.success) return { ok: true, user: r.data };
  const f = r.error.flatten().fieldErrors;
  return { ok: false, errors: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v[0]])) };
}
