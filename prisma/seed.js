const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Start seeding StudyShare...");

  // 🔐 senha segura
  const hashedPassword = await bcrypt.hash("12345678", 10);

  // 👤 USERS (idempotente)
  const user1 = await prisma.user.upsert({
    where: { email: "admin@studyshare.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@studyshare.com",
      password: hashedPassword,
      area: "Admin"
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: "bruno@studyshare.com" },
    update: {},
    create: {
      name: "Bruno Costa",
      email: "bruno@studyshare.com",
      password: hashedPassword,
      area: "Psicologia"
    }
  });

  const user3 = await prisma.user.upsert({
    where: { email: "carla@studyshare.com" },
    update: {},
    create: {
      name: "Carla Dias",
      email: "carla@studyshare.com",
      password: hashedPassword,
      area: "Medicina"
    }
  });

  console.log("✅ Users created");

  // 📚 CATEGORIES
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Psicologia" },
      update: {},
      create: { name: "Psicologia", icon: "Brain" }
    }),
    prisma.category.upsert({
      where: { name: "Medicina" },
      update: {},
      create: { name: "Medicina", icon: "HeartPulse" }
    }),
    prisma.category.upsert({
      where: { name: "Ensino Médio" },
      update: {},
      create: { name: "Ensino Médio", icon: "GraduationCap" }
    }),
  ]);

  console.log("✅ Categories created");

  // 📂 FOLDERS
  const folders = await Promise.all([
    prisma.folder.upsert({
      where: { id: 1 },
      update: {},
      create: { name: "Psicologia Social", categoryId: categories[0].id }
    }),
    prisma.folder.upsert({
      where: { id: 2 },
      update: {},
      create: { name: "Neurociência", categoryId: categories[0].id }
    }),
    prisma.folder.upsert({
      where: { id: 3 },
      update: {},
      create: { name: "Anatomia", categoryId: categories[1].id }
    }),
  ]);

  console.log("✅ Folders created");

  // 🏷️ TAGS
  const tag1 = await prisma.tag.upsert({
    where: { name: "psicologia" },
    update: {},
    create: { name: "psicologia" }
  });

  const tag2 = await prisma.tag.upsert({
    where: { name: "medicina" },
    update: {},
    create: { name: "medicina" }
  });

  // 📝 RESUMES
  await prisma.resume.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: "Resumo Psicologia Social",
      description: "Conceitos fundamentais",
      content: "Conteúdo exemplo de psicologia social...",
      userId: user2.id,
      folderId: folders[0].id,
      views: 100,
      tags: {
        connect: [{ id: tag1.id }]
      }
    }
  });

  await prisma.resume.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: "Resumo Anatomia Humana",
      description: "Sistema esquelético",
      content: "Conteúdo exemplo de anatomia...",
      userId: user3.id,
      folderId: folders[2].id,
      views: 200,
      tags: {
        connect: [{ id: tag2.id }]
      }
    }
  });

  console.log("✅ Resumes created");

  console.log("🚀 Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });