import { z } from 'zod';

export const RouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  points: z.array(z.tuple([z.number(), z.number()])),
  distance: z.number().positive(),
  neighborhood: z.string(),
  createdAt: z.date(),
});

export type Route = z.infer<typeof RouteSchema>;

export class RouteModel {
  constructor(private data: Route) {}

  get formattedDistance() {
    return `${(this.data.distance / 1000).toFixed(2)} km`;
  }

  get summary() {
    return `${this.data.name} in ${this.data.neighborhood} (${this.formattedDistance})`;
  }
}
