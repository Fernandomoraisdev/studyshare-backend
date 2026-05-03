const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listTags = async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      take: 200,
      include: {
        _count: {
          select: { resumes: true },
        },
      },
    });

    tags.sort((a, b) => {
      const diff = b._count.resumes - a._count.resumes;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    res.json(
      tags.slice(0, 50).map((tag) => ({
        id: tag.id,
        name: tag.name,
        posts: tag._count.resumes,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar tags.', error: err.message });
  }
};

module.exports = { listTags };
