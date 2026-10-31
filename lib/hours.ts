import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { resolveRate, shiftPay } from "./pay";

/** Shifts in a range with hours and pay worked out. */
export async function hoursReport(where: Prisma.TimeEntryWhereInput) {
  const entries = await db.timeEntry.findMany({
    where,
    orderBy: [{ user: { name: "asc" } }, { clockIn: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true, hourlyRate: true, serviceRates: true } },
      service: true,
      client: true,
    },
  });
  return entries.map((e) => {
    const rate = resolveRate({
      override: e.user.serviceRates.find((r) => r.serviceId === e.serviceId)?.rate,
      serviceRate: e.service?.defaultRate,
      baseRate: e.user.hourlyRate,
    });
    const pay = e.clockOut ? shiftPay(e.clockIn, e.clockOut, rate) : { hours: 0, amount: 0 };
    return { ...e, rate, ...pay };
  });
}
