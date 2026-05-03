const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        folders: true, // Retorna as pastas de cada categoria
      }
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar categorias.', error: err.message });
  }
};

const getCategoryFolders = async (req, res) => {
  const { id } = req.params;
  try {
    const folders = await prisma.folder.findMany({
      where: { categoryId: parseInt(id) },
      include: {
        resumes: {
          take: 5, // Apenas os resumos mais recentes da pasta
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, area: true } } }
        }
      }
    });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar pastas.', error: err.message });
  }
};

const createCategory = async (req, res) => {
  const { name, icon } = req.body;
  try {
    const category = await prisma.category.create({
      data: { name, icon }
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar categoria.', error: err.message });
  }
};

const createFolder = async (req, res) => {
  const { name, categoryId } = req.body;
  try {
    const folder = await prisma.folder.create({
      data: { name, categoryId: parseInt(categoryId) }
    });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar pasta.', error: err.message });
  }
};

module.exports = { getAllCategories, getCategoryFolders, createCategory, createFolder };
