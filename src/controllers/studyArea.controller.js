const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const listStudyAreas = async (req, res) => {
  const q = String(req.query.q || '').trim();

  try {
    const areas = await prisma.studyArea.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { group: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      take: 200,
    });

    res.json(areas);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar areas de estudo.', error: err.message });
  }
};

module.exports = { listStudyAreas };
