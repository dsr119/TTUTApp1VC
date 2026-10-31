// Demo data for local review. All people and children here are fictional.
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_PASSWORD = "Password123!";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const people: { email: string; name: string; title: string; role: Role; rate: number; phone: string }[] = [
    { email: "owner@example.com", name: "Olivia Owner", title: "Clinical Director", role: "OWNER", rate: 60, phone: "555-0100" },
    { email: "admin@example.com", name: "Adam Admin", title: "Office Manager", role: "ADMIN", rate: 30, phone: "555-0101" },
    { email: "staff@example.com", name: "Sam Staff", title: "Behavior Technician", role: "STAFF", rate: 22, phone: "555-0102" },
    { email: "taylor@example.com", name: "Taylor Therapist", title: "Speech Therapist", role: "STAFF", rate: 45, phone: "555-0103" },
    { email: "jordan@example.com", name: "Jordan Jones", title: "Occupational Therapist", role: "STAFF", rate: 42, phone: "555-0104" },
  ];

  const users: Record<string, string> = {};
  for (const p of people) {
    const u = await db.user.upsert({
      where: { email: p.email },
      update: {},
      create: { email: p.email, name: p.name, title: p.title, role: p.role, hourlyRate: p.rate, phone: p.phone, passwordHash },
    });
    users[p.email] = u.id;
  }
  const owner = users["owner@example.com"];
  await db.user.updateMany({ where: { id: { in: [users["admin@example.com"], users["taylor@example.com"], users["jordan@example.com"]] } }, data: { managerId: owner } });
  await db.user.update({ where: { id: users["staff@example.com"] }, data: { managerId: users["taylor@example.com"] } });

  const services = [
    { name: "Evaluation", defaultRate: 55 },
    { name: "Individual Session", defaultRate: null },
    { name: "Group Session", defaultRate: 35 },
    { name: "Admin / Documentation", defaultRate: null },
  ];
  const serviceIds: Record<string, string> = {};
  for (const s of services) {
    const row = await db.service.upsert({ where: { name: s.name }, update: {}, create: s });
    serviceIds[s.name] = row.id;
  }

  if ((await db.client.count()) === 0) {
    await db.client.createMany({
      data: [
        { firstName: "Avery", lastInitial: "B" },
        { firstName: "Charlie", lastInitial: "D" },
        { firstName: "Emerson", lastInitial: "F" },
        { firstName: "Harper", lastInitial: "K" },
      ],
    });
  }
  const kids = await db.client.findMany();

  if ((await db.timeEntry.count()) === 0) {
    const day = (daysAgo: number, hour: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - daysAgo);
      d.setUTCHours(hour, 0, 0, 0);
      return d;
    };
    await db.timeEntry.createMany({
      data: [
        { userId: users["staff@example.com"], clockIn: day(1, 14), clockOut: day(1, 18), serviceId: serviceIds["Individual Session"], clientId: kids[0].id, source: "CLOCK", status: "APPROVED" },
        { userId: users["staff@example.com"], clockIn: day(2, 15), clockOut: day(2, 17), serviceId: serviceIds["Group Session"], clientId: kids[1].id, source: "MANUAL", status: "PENDING", note: "Forgot to clock in" },
        { userId: users["taylor@example.com"], clockIn: day(1, 13), clockOut: day(1, 15), serviceId: serviceIds["Evaluation"], clientId: kids[2].id, source: "CLOCK", status: "APPROVED" },
        { userId: users["jordan@example.com"], clockIn: day(3, 14), clockOut: day(3, 19), serviceId: serviceIds["Individual Session"], clientId: kids[3].id, source: "CLOCK", status: "APPROVED" },
      ],
    });
  }

  if ((await db.announcement.count()) === 0) {
    await db.announcement.create({
      data: { authorId: owner, title: "Welcome to Connect Team", body: "This is where we'll post team updates. Clock in and out from the Time tab, and message anyone from the Directory." },
    });
  }

  if ((await db.conversation.count()) === 0) {
    const all = Object.values(users);
    await db.conversation.create({
      data: {
        name: "Whole Team",
        isGroup: true,
        createdById: owner,
        members: { create: all.map((userId) => ({ userId })) },
        messages: { create: [{ senderId: owner, body: "Hi everyone, welcome aboard!" }] },
      },
    });
  }

  console.log(`Seeded. Sign in as owner@, admin@ or staff@example.com with password ${DEMO_PASSWORD}`);
}

main().finally(() => db.$disconnect());
