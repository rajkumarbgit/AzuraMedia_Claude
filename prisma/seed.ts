import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

const PAGE_DEFS = [
  { key: "jobs", label: "Job Management" },
  { key: "ceo-dashboard", label: "CEO Dashboard" },
  { key: "production", label: "Production Timeline" },
  { key: "admin", label: "Admin Panel" },
  { key: "dashboard", label: "My Dashboard" },
];

const SHIFTS = [
  { code: "APAC", label: "APAC", startTime: "06:00", endTime: "14:00", breakMins: 60, isDefault: false },
  { code: "EMEA", label: "EMEA", startTime: "14:00", endTime: "22:00", breakMins: 60, isDefault: false },
  { code: "AMER", label: "AMER", startTime: "22:00", endTime: "06:00", breakMins: 60, isDefault: false },
  { code: "GEN", label: "GEN (Default)", startTime: "09:00", endTime: "18:00", breakMins: 60, isDefault: true },
] as const;

async function main() {
  console.log("Seeding…");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Pages
  for (const p of PAGE_DEFS) {
    await prisma.page.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  // Shifts
  for (const s of SHIFTS) {
    await prisma.shift.upsert({ where: { code: s.code as any }, update: {}, create: s as any });
  }

  // Default permissions: PM sees jobs+dashboard; Lead/Ops see production+dashboard.
  const pages = await prisma.page.findMany();
  const pageByKey = Object.fromEntries(pages.map((p) => [p.key, p]));
  const defaults: Array<[string, string, boolean]> = [
    ["PROJECT_MANAGER", "jobs", true],
    ["PROJECT_MANAGER", "dashboard", true],
    ["PRODUCTION_LEAD", "production", true],
    ["PRODUCTION_LEAD", "dashboard", true],
    ["OPS", "production", true],
    ["OPS", "dashboard", true],
    ["ADMIN", "admin", true],
    ["ADMIN", "dashboard", true],
  ];
  for (const [role, key, canAccess] of defaults) {
    await prisma.rolePagePermission.upsert({
      where: { role_pageId: { role: role as any, pageId: pageByKey[key].id } },
      update: { canAccess },
      create: { role: role as any, pageId: pageByKey[key].id, canAccess },
    });
  }

  // Designations
  const desigNames = ["Producer", "Senior Editor", "Editor", "Motion Designer", "QC Specialist"];
  const designations: Record<string, string> = {};
  for (const name of desigNames) {
    const d = await prisma.designation.upsert({ where: { name }, update: {}, create: { name } });
    designations[name] = d.id;
  }

  // Users
  const ceo = await prisma.user.upsert({
    where: { email: "ceo@azuramedia.com" },
    update: {},
    create: { name: "Aditi Rao", email: "ceo@azuramedia.com", passwordHash, role: "CEO" },
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@azuramedia.com" },
    update: {},
    create: { name: "System Admin", email: "admin@azuramedia.com", passwordHash, role: "ADMIN" },
  });
  const pm = await prisma.user.upsert({
    where: { email: "pm@azuramedia.com" },
    update: {},
    create: { name: "Rajkumar Vino", email: "pm@azuramedia.com", passwordHash, role: "PROJECT_MANAGER" },
  });
  const lead1 = await prisma.user.upsert({
    where: { email: "lead1@azuramedia.com" },
    update: {},
    create: {
      name: "Priya Nair",
      email: "lead1@azuramedia.com",
      passwordHash,
      role: "PRODUCTION_LEAD",
      designationId: designations["Producer"],
      defaultShift: "GEN",
    },
  });
  const ops1 = await prisma.user.upsert({
    where: { email: "ops1@azuramedia.com" },
    update: {},
    create: {
      name: "Arjun Mehta",
      email: "ops1@azuramedia.com",
      passwordHash,
      role: "OPS",
      designationId: designations["Editor"],
      defaultShift: "APAC",
    },
  });
  const ops2 = await prisma.user.upsert({
    where: { email: "ops2@azuramedia.com" },
    update: {},
    create: {
      name: "Sara Khan",
      email: "ops2@azuramedia.com",
      passwordHash,
      role: "OPS",
      designationId: designations["Motion Designer"],
      defaultShift: "EMEA",
    },
  });
  const ops3 = await prisma.user.upsert({
    where: { email: "ops3@azuramedia.com" },
    update: {},
    create: {
      name: "Liam Carter",
      email: "ops3@azuramedia.com",
      passwordHash,
      role: "OPS",
      designationId: designations["QC Specialist"],
      defaultShift: "AMER",
    },
  });

  // Clients
  const clientA = await prisma.client.upsert({
    where: { id: "seed-client-a" },
    update: {},
    create: { id: "seed-client-a", name: "Nimbus Retail Group", contactName: "John Doe", contactEmail: "john@nimbusretail.com", currency: "USD" },
  });
  const clientB = await prisma.client.upsert({
    where: { id: "seed-client-b" },
    update: {},
    create: { id: "seed-client-b", name: "Solace Bank plc", contactName: "Emma Wright", contactEmail: "emma@solacebank.co.uk", currency: "GBP" },
  });

  // Jobs
  const existingJob1 = await prisma.job.findUnique({ where: { jobNo: "JOB-2026-001" } });
  const job1 =
    existingJob1 ??
    (await prisma.job.create({
      data: {
        jobNo: "JOB-2026-001",
        title: "Q3 Campaign Video Series",
        clientId: clientA.id,
        currency: "USD",
        clientBudget: 45000,
        productionSpendPercent: 35,
        pmComment: "High priority campaign launch, tight Q3 deadline.",
        status: "IN_PROGRESS",
        estimatedHours: 220,
        createdById: pm.id,
        mandates: { create: [{ name: "Hero video edit" }, { name: "Social cutdowns" }] },
      },
    }));

  const existingJob2 = await prisma.job.findUnique({ where: { jobNo: "JOB-2026-002" } });
  const job2 =
    existingJob2 ??
    (await prisma.job.create({
      data: {
        jobNo: "JOB-2026-002",
        title: "Annual Report Animation",
        clientId: clientB.id,
        currency: "GBP",
        clientBudget: 28000,
        productionSpendPercent: 40,
        pmComment: "Compliance review required before final delivery.",
        status: "COMPLETED",
        estimatedHours: 140,
        createdById: pm.id,
        mandates: { create: [{ name: "Storyboard" }, { name: "2D animation" }] },
      },
    }));

  if (!existingJob1) {
    await prisma.timelineEvent.create({
      data: { jobId: job1.id, type: "JOB_CREATED", description: `Job ${job1.jobNo} created by ${pm.name}`, version: 1, actorId: pm.id },
    });
  }
  if (!existingJob2) {
    await prisma.timelineEvent.create({
      data: { jobId: job2.id, type: "JOB_CREATED", description: `Job ${job2.jobNo} created by ${pm.name}`, version: 1, actorId: pm.id },
    });
  }

  // Tasks + assignments for job1
  const taskCount = await prisma.task.count({ where: { jobId: job1.id } });
  if (taskCount === 0) {
    const today = new Date();
    const t1 = await prisma.task.create({
      data: {
        jobId: job1.id,
        taskNo: `${job1.jobNo}-T1`,
        name: "Rough cut edit",
        leadId: lead1.id,
        estimatedHours: 40,
        startDate: today,
        endDate: new Date(today.getTime() + 5 * 86400000),
      },
    });
    await prisma.taskAssignment.create({
      data: { taskId: t1.id, userId: ops1.id, shift: "APAC", date: today, hoursBooked: 6 },
    });
    await prisma.taskAssignment.create({
      data: { taskId: t1.id, userId: ops2.id, shift: "EMEA", date: today, hoursBooked: 5 },
    });
    await prisma.timelineEvent.create({
      data: { jobId: job1.id, type: "TASK_CREATED", description: `Task ${t1.taskNo} created`, version: 1, actorId: pm.id },
    });
  }

  // A pending mandate-add approval requested by the lead
  const pendingApprovalExists = await prisma.approvalRequest.findFirst({ where: { jobId: job1.id, status: "PENDING" } });
  if (!pendingApprovalExists) {
    await prisma.approvalRequest.create({
      data: {
        jobId: job1.id,
        type: "MANDATE_ADD",
        comment: "Client asked for an additional 15s teaser cut.",
        payload: { name: "15s teaser cut", description: "Extra social teaser" },
        requestedById: lead1.id,
      },
    });
    await prisma.timelineEvent.create({
      data: {
        jobId: job1.id,
        type: "MANDATE_ADD_REQUESTED",
        description: `${lead1.name} requested new mandate "15s teaser cut"`,
        version: job1.version,
        actorId: lead1.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login as any of:");
  console.log("  ceo@azuramedia.com / " + PASSWORD);
  console.log("  admin@azuramedia.com / " + PASSWORD);
  console.log("  pm@azuramedia.com / " + PASSWORD);
  console.log("  lead1@azuramedia.com / " + PASSWORD);
  console.log("  ops1@azuramedia.com / " + PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
