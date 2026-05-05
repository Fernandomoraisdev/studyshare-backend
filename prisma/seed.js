const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding for StudyShare App...");

  // Create example users
  const hashedPassword = await bcrypt.hash("12345678", 12);


  const user1 = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@studyshare.com",
      password: "123456"
    }
  });

  // Create categories
  const category1 = await prisma.category.upsert({
    where: { name: "Psicologia" },
    update: {},
    create: { name: "Psicologia", icon: "Brain" },
  });
  console.log(`Created category: ${category1.name}`);

  const category2 = await prisma.category.upsert({
    where: { name: "Medicina" },
    update: {},
    create: { name: "Medicina", icon: "HeartPulse" },
  });
  console.log(`Created category: ${category2.name}`);

  const category3 = await prisma.category.upsert({
    where: { name: "Ensino Médio" },
    update: {},
    create: { name: "Ensino Médio", icon: "GraduationCap" },
  });
  console.log(`Created category: ${category3.name}`);

  const category4 = await prisma.category.upsert({
    where: { name: "Direito" },
    update: {},
    create: { name: "Direito", icon: "Scale" },
  });
  console.log(`Created category: ${category4.name}`);

  const category5 = await prisma.category.upsert({
    where: { name: "Engenharia" },
    update: {},
    create: { name: "Engenharia", icon: "Construction" },
  });
  console.log(`Created category: ${category5.name}`);

  // Create folders
  const folder1 = await prisma.folder.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Psicologia Social", categoryId: category1.id },
  });
  console.log(`Created folder: ${folder1.name}`);

  const folder2 = await prisma.folder.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Neurociência Cognitiva", categoryId: category1.id },
  });
  console.log(`Created folder: ${folder2.name}`);

  const folder3 = await prisma.folder.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "Anatomia Humana", categoryId: category2.id },
  });
  console.log(`Created folder: ${folder3.name}`);

  const folder4 = await prisma.folder.upsert({
    where: { id: 4 },
    update: {},
    create: { name: "Física - Eletrodinâmica", categoryId: category3.id },
  });
  console.log(`Created folder: ${folder4.name}`);

  const folder5 = await prisma.folder.upsert({
    where: { id: 5 },
    update: {},
    create: { name: "Matemática - Cálculo I", categoryId: category3.id },
  });
  console.log(`Created folder: ${folder5.name}`);

  // Create example resumes (fileUrl will be dummy for now)
  const resume1 = await prisma.resume.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: "Resumo de Psicologia Social: Conceitos Fundamentais",
      description: "Principais teorias e conceitos da psicologia social, ideal para iniciantes.",
      content:
        "Este post é um exemplo de conteúdo em texto.\n\n• Conceitos: percepção social, influência, atitudes.\n• Experimentos clássicos e autores.\n• Aplicações no cotidiano.",
      userId: user1.id,
      folderId: folder1.id,
      views: 150,
      tags: {
        connectOrCreate: [
          { where: { name: "psicologia" }, create: { name: "psicologia" } },
          { where: { name: "social" }, create: { name: "social" } },
          { where: { name: "teorias" }, create: { name: "teorias" } },
        ],
      },
    },
  });
  console.log(`Created resume: ${resume1.title}`);

  const resume2 = await prisma.resume.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: "Introdução à Neurociência: Sinapses e Neurotransmissores",
      description: "Material completo sobre o funcionamento das sinapses e os principais neurotransmissores.",
      content:
        "Sinapses químicas e elétricas:\n\n1) Potencial de ação → liberação de neurotransmissores.\n2) Receptores pós-sinápticos.\n3) Recaptação e degradação.\n\nNeurotransmissores: glutamato, GABA, dopamina, serotonina.",
      userId: user1.id,
      folderId: folder2.id,
      views: 230,
      tags: {
        connectOrCreate: [
          { where: { name: "neurociencia" }, create: { name: "neurociencia" } },
          { where: { name: "sinapses" }, create: { name: "sinapses" } },
          { where: { name: "biologia" }, create: { name: "biologia" } },
        ],
      },
    },
  });
  console.log(`Created resume: ${resume2.title}`);

  const resume3 = await prisma.resume.upsert({
    where: { id: 3 },
    update: {},
    create: {
      title: "Atlas de Anatomia Humana: Sistema Esquelético",
      description: "Imagens detalhadas e descrições do sistema esquelético humano.",
      content:
        "Checklist rápido do esqueleto:\n\n• Axial: crânio, coluna, caixa torácica.\n• Apendicular: cinturas + membros.\n• Funções: suporte, proteção, hematopoiese, reserva mineral.",
      userId: user2.id,
      folderId: folder3.id,
      views: 300,
      tags: {
        connectOrCreate: [
          { where: { name: "anatomia" }, create: { name: "anatomia" } },
          { where: { name: "medicina" }, create: { name: "medicina" } },
          { where: { name: "esqueleto" }, create: { name: "esqueleto" } },
        ],
      },
    },
  });
  console.log(`Created resume: ${resume3.title}`);

  const resume4 = await prisma.resume.upsert({
    where: { id: 4 },
    update: {},
    create: {
      title: "Formulário de Eletrodinâmica para Vestibular",
      description: "Principais fórmulas e conceitos de eletrodinâmica para revisão rápida.",
      content:
        "Fórmulas essenciais:\n\n• U = R·i\n• P = U·i = R·i² = U²/R\n• E = P·Δt\n\nDicas: atenção às unidades (V, A, Ω, W, J) e conversões.",
      userId: user3.id,
      folderId: folder4.id,
      views: 80,
      tags: {
        connectOrCreate: [
          { where: { name: "fisica" }, create: { name: "fisica" } },
          { where: { name: "vestibular" }, create: { name: "vestibular" } },
          { where: { name: "formulas" }, create: { name: "formulas" } },
        ],
      },
    },
  });
  console.log(`Created resume: ${resume4.title}`);

  console.log("StudyShare App Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
