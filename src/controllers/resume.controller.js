const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const sanitizeFilename = (name) => {
  const base = String(name || 'post')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return base || 'post';
};

const normalizeTagName = (tag) =>
  tag
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
    .slice(0, 30);

const parseTags = (rawTags) => {
  if (!rawTags) return [];

  // Em multipart/form-data, `tags` costuma vir como string (ex: "bio,anatomia")
  // ou JSON string (ex: ["bio","anatomia"]).
  let value = rawTags;
  if (Array.isArray(value)) value = value.join(',');
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) value = parsed.join(',');
    }
  } catch (err) {
    // ignora
  }

  const tags = value
    .split(',')
    .map(normalizeTagName)
    .filter(Boolean);

  return [...new Set(tags)].slice(0, 10);
};

const buildResumeInclude = (viewerUserId) => ({
  user: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true } },
  folder: { include: { category: true } },
  tags: { select: { id: true, name: true } },
  _count: { select: { likes: true, comments: true, reposts: true, shares: true, savedBy: true, contributionRequests: true } },
  ...(viewerUserId
    ? {
        likes: { where: { userId: viewerUserId }, select: { userId: true } },
        reposts: { where: { userId: viewerUserId }, select: { userId: true } },
        savedBy: { where: { userId: viewerUserId }, select: { userId: true } },
      }
    : {}),
});

const toPublicResume = (resume, viewerUserId) => {
  const likedByMe = viewerUserId ? (resume.likes?.length || 0) > 0 : false;
  const repostedByMe = viewerUserId ? (resume.reposts?.length || 0) > 0 : false;
  const savedByMe = viewerUserId ? (resume.savedBy?.length || 0) > 0 : false;
  const { likes, reposts, savedBy, ...rest } = resume;
  return { ...rest, likedByMe, repostedByMe, savedByMe };
};

const uploadResume = async (req, res) => {
  const { title, description, content, folderId, tags } = req.body;
  const fileUrl = req.file ? `/uploads/resumes/${req.file.filename}` : null;
  const fileType = req.file ? req.file.mimetype.split('/')[1] : null;

  if (!title?.trim()) {
    return res.status(400).json({ message: 'Título é obrigatório.' });
  }

  if (!folderId) {
    return res.status(400).json({ message: 'Pasta é obrigatória.' });
  }

  const folderIdNumber = parseInt(folderId, 10);
  if (Number.isNaN(folderIdNumber)) {
    return res.status(400).json({ message: 'Pasta inválida.' });
  }

  const normalizedContent = content?.trim() || null;
  if (!fileUrl && !normalizedContent) {
    return res.status(400).json({ message: 'Envie um arquivo ou escreva um texto no post.' });
  }

  try {
    const tagNames = parseTags(tags);

    const resume = await prisma.resume.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        content: normalizedContent,
        ...(fileUrl ? { fileUrl, fileType } : {}),
        userId: req.user.id,
        folderId: folderIdNumber,
        ...(tagNames.length
          ? {
              tags: {
                connectOrCreate: tagNames.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
      },
      include: buildResumeInclude(req.user.id),
    });

    res.status(201).json({ message: 'Post publicado com sucesso!', resume: toPublicResume(resume, req.user.id) });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao publicar post.', error: err.message });
  }
};

const getFeed = async (req, res) => {
  const { q, tag, categoryId, folderId, following, page = '1', limit = '20' } = req.query;
  const viewerUserId = req.user?.id;

  const take = Math.min(parseInt(limit, 10) || 20, 50);
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (pageNumber - 1) * take;

  const where = {};

  if (typeof q === 'string' && q.trim()) {
    where.OR = [
      { title: { contains: q.trim() } },
      { description: { contains: q.trim() } },
      { content: { contains: q.trim() } },
    ];
  }

  if (typeof tag === 'string' && tag.trim()) {
    where.tags = { some: { name: normalizeTagName(tag) } };
  }

  if (folderId !== undefined) {
    const folderIdNumber = parseInt(folderId, 10);
    if (Number.isNaN(folderIdNumber)) {
      return res.status(400).json({ message: 'folderId inválido.' });
    }
    where.folderId = folderIdNumber;
  }

  if (categoryId !== undefined) {
    const categoryIdNumber = parseInt(categoryId, 10);
    if (Number.isNaN(categoryIdNumber)) {
      return res.status(400).json({ message: 'categoryId inválido.' });
    }
    where.folder = { categoryId: categoryIdNumber };
  }

  try {
    const followingOnly = String(following).toLowerCase() === 'true' || String(following) === '1';
    if (followingOnly) {
      if (!viewerUserId) return res.status(401).json({ message: 'Faça login para ver o feed de seguindo.' });

      const followingUsers = await prisma.userFollow.findMany({
        where: { followerId: viewerUserId },
        select: { followingId: true },
      });

      const ids = [...new Set([viewerUserId, ...followingUsers.map((f) => f.followingId)])];
      where.userId = { in: ids };
    }

    const resumes = await prisma.resume.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: buildResumeInclude(viewerUserId),
    });

    res.json(resumes.map((r) => toPublicResume(r, viewerUserId)));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar feed.', error: err.message });
  }
};

const getResumesByFolder = async (req, res) => {
  const { folderId } = req.params;
  const viewerUserId = req.user?.id;

  const folderIdNumber = parseInt(folderId, 10);
  if (Number.isNaN(folderIdNumber)) {
    return res.status(400).json({ message: 'Pasta inválida.' });
  }

  try {
    const resumes = await prisma.resume.findMany({
      where: { folderId: folderIdNumber },
      include: {
        user: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true } },
        tags: { select: { id: true, name: true } },
        _count: { select: { likes: true, comments: true, reposts: true, shares: true, savedBy: true, contributionRequests: true } },
        ...(viewerUserId
          ? {
              likes: { where: { userId: viewerUserId }, select: { userId: true } },
              reposts: { where: { userId: viewerUserId }, select: { userId: true } },
              savedBy: { where: { userId: viewerUserId }, select: { userId: true } },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(resumes.map((r) => toPublicResume(r, viewerUserId)));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar resumos.', error: err.message });
  }
};

const getResumeDetails = async (req, res) => {
  const { id } = req.params;
  const viewerUserId = req.user?.id;
  const resumeId = parseInt(id, 10);

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const resume = await prisma.resume.update({
      where: { id: resumeId },
      data: { views: { increment: 1 } },
      include: buildResumeInclude(viewerUserId),
    });
    res.json(toPublicResume(resume, viewerUserId));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar detalhes do resumo.', error: err.message });
  }
};

const searchResumes = async (req, res) => {
  const { q } = req.query;
  const viewerUserId = req.user?.id;

  if (typeof q !== 'string' || !q.trim()) {
    return res.json([]);
  }

  try {
    const resumes = await prisma.resume.findMany({
      where: {
        OR: [
          { title: { contains: q.trim() } },
          { description: { contains: q.trim() } },
          { content: { contains: q.trim() } },
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: buildResumeInclude(viewerUserId),
    });
    res.json(resumes.map((r) => toPublicResume(r, viewerUserId)));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao pesquisar resumos.', error: err.message });
  }
};

const toggleLike = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const existing = await prisma.resumeLike.findUnique({
      where: { userId_resumeId: { userId, resumeId } },
    });

    let liked = false;
    if (existing) {
      await prisma.resumeLike.delete({ where: { userId_resumeId: { userId, resumeId } } });
      liked = false;
    } else {
      await prisma.resumeLike.create({ data: { userId, resumeId } });
      liked = true;
    }

    const likeCount = await prisma.resumeLike.count({ where: { resumeId } });
    res.json({ liked, likeCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao curtir post.', error: err.message });
  }
};

const getResumeComments = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const comments = await prisma.resumeComment.findMany({
      where: { resumeId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true } },
      },
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar comentários.', error: err.message });
  }
};

const addResumeComment = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const { content } = req.body;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'Comentário não pode estar vazio.' });
  }

  try {
    const comment = await prisma.resumeComment.create({
      data: {
        content: content.trim().slice(0, 2000),
        userId: req.user.id,
        resumeId,
      },
      include: {
        user: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true } },
      },
    });

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao comentar.', error: err.message });
  }
};

const getResumeForEdit = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const viewerUserId = req.user.id;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: buildResumeInclude(viewerUserId),
    });

    if (!resume) return res.status(404).json({ message: 'Post não encontrado.' });
    if (resume.userId !== viewerUserId) return res.status(403).json({ message: 'Você não pode editar este post.' });

    res.json(toPublicResume(resume, viewerUserId));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar post para edição.', error: err.message });
  }
};

const updateResume = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const viewerUserId = req.user.id;
  const { title, description, content, folderId, tags, removeFile } = req.body;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: 'Título é obrigatório.' });
  }

  try {
    const existing = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { id: true, userId: true, fileUrl: true, content: true },
    });

    if (!existing) return res.status(404).json({ message: 'Post não encontrado.' });
    if (existing.userId !== viewerUserId) return res.status(403).json({ message: 'Você não pode editar este post.' });

    const data = {
      title: title.trim(),
    };

    const nextDescription = description !== undefined ? String(description || '').trim() || null : undefined;
    const nextContent = content !== undefined ? String(content || '').trim() || null : undefined;

    if (nextDescription !== undefined) data.description = nextDescription;
    if (nextContent !== undefined) data.content = nextContent;

    if (folderId !== undefined) {
      const folderIdNumber = parseInt(folderId, 10);
      if (Number.isNaN(folderIdNumber)) {
        return res.status(400).json({ message: 'Pasta inválida.' });
      }

      const folderExists = await prisma.folder.findUnique({ where: { id: folderIdNumber }, select: { id: true } });
      if (!folderExists) return res.status(400).json({ message: 'Pasta não encontrada.' });

      data.folderId = folderIdNumber;
    }

    if (tags !== undefined) {
      const tagNames = parseTags(tags);
      data.tags =
        tagNames.length > 0
          ? {
              set: [],
              connectOrCreate: tagNames.map((name) => ({
                where: { name },
                create: { name },
              })),
            }
          : { set: [] };
    }

    const shouldRemoveFile = String(removeFile).toLowerCase() === 'true' || String(removeFile) === '1';
    if (shouldRemoveFile) {
      data.fileUrl = null;
      data.fileType = null;

      if (existing.fileUrl) {
        const uploadsRoot = path.join(__dirname, '../../uploads');
        const resumesDir = path.join(uploadsRoot, 'resumes');
        const basename = path.basename(existing.fileUrl);
        const filePath = path.join(resumesDir, basename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          // Se não conseguir apagar o arquivo, ainda assim atualiza o DB
        }
      }
    }

    const finalContent = nextContent !== undefined ? nextContent : existing.content;
    const finalFileUrl = shouldRemoveFile ? null : existing.fileUrl;
    if (!finalContent && !finalFileUrl) {
      return res.status(400).json({ message: 'O post precisa ter texto ou arquivo.' });
    }

    const updated = await prisma.resume.update({
      where: { id: resumeId },
      data,
      include: buildResumeInclude(viewerUserId),
    });

    res.json({ message: 'Post atualizado!', resume: toPublicResume(updated, viewerUserId) });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar post.', error: err.message });
  }
};

const deleteResume = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const viewerUserId = req.user.id;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const existing = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { id: true, userId: true, fileUrl: true },
    });

    if (!existing) return res.status(404).json({ message: 'Post não encontrado.' });
    if (existing.userId !== viewerUserId) return res.status(403).json({ message: 'Você não pode excluir este post.' });

    if (existing.fileUrl) {
      const uploadsRoot = path.join(__dirname, '../../uploads');
      const resumesDir = path.join(uploadsRoot, 'resumes');
      const basename = path.basename(existing.fileUrl);
      const filePath = path.join(resumesDir, basename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        // ignora
      }
    }

    await prisma.resume.delete({ where: { id: resumeId } });
    res.json({ message: 'Post excluído.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir post.', error: err.message });
  }
};

const replaceResumeFile = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const viewerUserId = req.user.id;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
  }

  const fileUrl = `/uploads/resumes/${req.file.filename}`;
  const fileType = req.file.mimetype ? req.file.mimetype.split('/')[1] : null;

  try {
    const existing = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { id: true, userId: true, fileUrl: true },
    });

    if (!existing) return res.status(404).json({ message: 'Post não encontrado.' });
    if (existing.userId !== viewerUserId) return res.status(403).json({ message: 'Você não pode editar este post.' });

    if (existing.fileUrl) {
      const uploadsRoot = path.join(__dirname, '../../uploads');
      const resumesDir = path.join(uploadsRoot, 'resumes');
      const basename = path.basename(existing.fileUrl);
      const filePath = path.join(resumesDir, basename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        // ignora
      }
    }

    const updated = await prisma.resume.update({
      where: { id: resumeId },
      data: { fileUrl, fileType },
      include: buildResumeInclude(viewerUserId),
    });

    res.json({ message: 'Arquivo atualizado!', resume: toPublicResume(updated, viewerUserId) });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao trocar arquivo.', error: err.message });
  }
};

const downloadResume = async (req, res) => {
  const resumeId = parseInt(req.params.id, 10);
  const { type } = req.query;

  if (Number.isNaN(resumeId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: {
        user: { select: { name: true } },
        tags: { select: { name: true } },
      },
    });

    if (!resume) return res.status(404).json({ message: 'Post não encontrado.' });

    const wantText = String(type).toLowerCase() === 'text' || String(type).toLowerCase() === 'txt';

    if (!wantText && resume.fileUrl) {
      const uploadsRoot = path.join(__dirname, '../../uploads');
      const resumesDir = path.join(uploadsRoot, 'resumes');
      const basename = path.basename(resume.fileUrl);
      const filePath = path.join(resumesDir, basename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Arquivo não encontrado.' });
      }

      const ext = path.extname(filePath) || (resume.fileType ? `.${resume.fileType}` : '');
      const downloadName = `${sanitizeFilename(resume.title)}${ext}`;
      return res.download(filePath, downloadName);
    }

    const tagsLine = resume.tags?.length ? `Tags: ${resume.tags.map((t) => `#${t.name}`).join(' ')}` : null;
    const header = [
      resume.title,
      resume.description ? `Descrição: ${resume.description}` : null,
      tagsLine,
      resume.user?.name ? `Autor: ${resume.user.name}` : null,
      `Publicado em: ${new Date(resume.createdAt).toLocaleString('pt-BR')}`,
      '',
      resume.content || '',
    ]
      .filter(Boolean)
      .join('\n');

    const filename = `${sanitizeFilename(resume.title)}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(header);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao baixar post.', error: err.message });
  }
};

module.exports = {
  uploadResume,
  getFeed,
  getResumesByFolder,
  getResumeDetails,
  searchResumes,
  toggleLike,
  getResumeComments,
  addResumeComment,
  getResumeForEdit,
  updateResume,
  deleteResume,
  replaceResumeFile,
  downloadResume,
};
