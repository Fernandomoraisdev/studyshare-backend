const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("ðŸŒ± Start seeding StudyShare...");

  // ðŸ” senha segura
  const hashedPassword = await bcrypt.hash("12345678", 10);


  const studyAreas = [
    ["Tecnologia", "Tecnologia"],
    ["Ciencia da Computacao", "Tecnologia"],
    ["Engenharia de Software", "Tecnologia"],
    ["Sistemas de Informacao", "Tecnologia"],
    ["Analise e Desenvolvimento de Sistemas", "Tecnologia"],
    ["Redes de Computadores", "Tecnologia"],
    ["Seguranca da Informacao", "Tecnologia"],
    ["Ciencia de Dados", "Tecnologia"],
    ["Inteligencia Artificial", "Tecnologia"],
    ["Design UX/UI", "Tecnologia"],
    ["Medicina", "Saude"],
    ["Enfermagem", "Saude"],
    ["Odontologia", "Saude"],
    ["Farmacia", "Saude"],
    ["Fisioterapia", "Saude"],
    ["Psicologia", "Saude"],
    ["Biomedicina", "Saude"],
    ["Nutricao", "Saude"],
    ["Veterinaria", "Saude"],
    ["Educacao Fisica", "Saude"],
    ["Engenharia Civil", "Engenharia"],
    ["Engenharia Mecanica", "Engenharia"],
    ["Engenharia Eletrica", "Engenharia"],
    ["Engenharia de Producao", "Engenharia"],
    ["Engenharia Quimica", "Engenharia"],
    ["Engenharia Ambiental", "Engenharia"],
    ["Engenharia de Computacao", "Engenharia"],
    ["Arquitetura e Urbanismo", "Engenharia"],
    ["Direito", "Humanas"],
    ["Administracao", "Negocios"],
    ["Contabilidade", "Negocios"],
    ["Economia", "Negocios"],
    ["Marketing", "Negocios"],
    ["Recursos Humanos", "Negocios"],
    ["Pedagogia", "Educacao"],
    ["Letras", "Educacao"],
    ["Historia", "Humanas"],
    ["Geografia", "Humanas"],
    ["Sociologia", "Humanas"],
    ["Filosofia", "Humanas"],
    ["Jornalismo", "Comunicacao"],
    ["Publicidade e Propaganda", "Comunicacao"],
    ["Design Grafico", "Criativas"],
    ["Artes Visuais", "Criativas"],
    ["Musica", "Criativas"],
    ["Matematica", "Exatas"],
    ["Fisica", "Exatas"],
    ["Quimica", "Exatas"],
    ["Biologia", "Biologicas"],
    ["Ensino Medio", "Educacao Basica"],
    ["Vestibular e ENEM", "Educacao Basica"],
  ];

  for (const [name, group] of studyAreas) {
    await prisma.studyArea.upsert({
      where: { name },
      update: { group },
      create: { name, group, icon: "GraduationCap" },
    });
  }

  console.log("Areas de estudo criadas");
  // ðŸ‘¤ USERS (idempotente)
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

  console.log("âœ… Users created");

  // ðŸ“š CATEGORIES
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
      where: { name: "Ensino MÃ©dio" },
      update: {},
      create: { name: "Ensino MÃ©dio", icon: "GraduationCap" }
    }),
  ]);

  console.log("âœ… Categories created");

  // ðŸ“‚ FOLDERS
  const folders = await Promise.all([
    prisma.folder.upsert({
      where: { id: 1 },
      update: {},
      create: { name: "Psicologia Social", categoryId: categories[0].id }
    }),
    prisma.folder.upsert({
      where: { id: 2 },
      update: {},
      create: { name: "NeurociÃªncia", categoryId: categories[0].id }
    }),
    prisma.folder.upsert({
      where: { id: 3 },
      update: {},
      create: { name: "Anatomia", categoryId: categories[1].id }
    }),
  ]);

  console.log("âœ… Folders created");

  // ðŸ·ï¸ TAGS
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

  // ðŸ“ RESUMES
  await prisma.resume.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: "Resumo Psicologia Social",
      description: "Conceitos fundamentais",
      content: "ConteÃºdo exemplo de psicologia social...",
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
      description: "Sistema esquelÃ©tico",
      content: "ConteÃºdo exemplo de anatomia...",
      userId: user3.id,
      folderId: folders[2].id,
      views: 200,
      tags: {
        connect: [{ id: tag2.id }]
      }
    }
  });

  console.log("âœ… Resumes created");

  console.log("ðŸš€ Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("âŒ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
