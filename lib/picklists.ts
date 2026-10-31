import { db } from "./db";

export async function getPicklists() {
  const [services, clients] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.client.findMany({ where: { active: true }, orderBy: [{ firstName: "asc" }, { lastInitial: "asc" }], select: { id: true, firstName: true, lastInitial: true } }),
  ]);
  return { services, clients: clients.map((c) => ({ id: c.id, name: kidName(c) })) };
}

export function kidName(c: { firstName: string; lastInitial: string }) {
  return `${c.firstName} ${c.lastInitial}.`;
}

export type Picklists = Awaited<ReturnType<typeof getPicklists>>;
