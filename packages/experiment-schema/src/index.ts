import { z } from 'zod';
// Dependency/bootstrap contract only. Scientific manifests are not defined yet.
export const serviceHealthSchema = z.object({ status: z.literal('ok'), service: z.string() });
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
