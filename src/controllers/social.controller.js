const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const userCardSelect = {
  id: true,
  name: true,
  area: true,
  photoUrl: true,
  coverUrl: true,
  bio: true,
};

const createNotification = async ({ userId, actorId, resumeId, type, message }) => {
  if (!userId || userId === actorId) return null;

  return prisma.notification.create({
    data: { userId, actorId, resumeId, type, message },
  });
};

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const sendFriendRequest = async (req, res) => {
  const receiverId = parseId(req.params.id);
  const requesterId = req.user.id;
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 500) : null;

  if (!receiverId) return res.status(400).json({ message: 'ID invalido.' });
  if (receiverId === requesterId) return res.status(400).json({ message: 'Voce nao pode adicionar a si mesmo.' });

  try {
    const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, name: true } });
    if (!receiver) return res.status(404).json({ message: 'Usuario nao encontrado.' });

    const existingFriendship = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: requesterId, friendId: receiverId } },
    });
    if (existingFriendship) return res.json({ message: 'Voces ja sao amigos.', status: 'ACCEPTED' });

    const request = await prisma.friendRequest.upsert({
      where: { requesterId_receiverId: { requesterId, receiverId } },
      update: { status: 'PENDING', message },
      create: { requesterId, receiverId, message },
      include: { requester: { select: userCardSelect }, receiver: { select: userCardSelect } },
    });

    await createNotification({
      userId: receiverId,
      actorId: requesterId,
      type: 'FRIEND_REQUEST',
      message: 'enviou uma solicitacao de amizade.',
    });

    res.status(201).json({ message: 'Solicitacao enviada.', request });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar solicitacao.', error: err.message });
  }
};

const acceptFriendRequest = async (req, res) => {
  const requestId = parseId(req.params.id);
  if (!requestId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    if (request.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Voce nao pode responder esta solicitacao.' });
    }

    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId: request.requesterId, friendId: request.receiverId } },
        update: {},
        create: { userId: request.requesterId, friendId: request.receiverId },
      }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId: request.receiverId, friendId: request.requesterId } },
        update: {},
        create: { userId: request.receiverId, friendId: request.requesterId },
      }),
    ]);

    await createNotification({
      userId: request.requesterId,
      actorId: req.user.id,
      type: 'FRIEND_ACCEPTED',
      message: 'aceitou sua solicitacao de amizade.',
    });

    res.json({ message: 'Solicitacao aceita.', status: 'ACCEPTED' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao aceitar solicitacao.', error: err.message });
  }
};

const declineFriendRequest = async (req, res) => {
  const requestId = parseId(req.params.id);
  if (!requestId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    if (request.receiverId !== req.user.id && request.requesterId !== req.user.id) {
      return res.status(403).json({ message: 'Voce nao pode alterar esta solicitacao.' });
    }

    const status = request.receiverId === req.user.id ? 'DECLINED' : 'CANCELLED';
    const updated = await prisma.friendRequest.update({ where: { id: requestId }, data: { status } });
    res.json({ message: 'Solicitacao atualizada.', request: updated });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar solicitacao.', error: err.message });
  }
};

const listFriendRequests = async (req, res) => {
  try {
    const [received, sent] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: req.user.id, status: 'PENDING' },
        include: { requester: { select: userCardSelect } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { requesterId: req.user.id, status: 'PENDING' },
        include: { receiver: { select: userCardSelect } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ received, sent });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar solicitacoes.', error: err.message });
  }
};

const listFriends = async (req, res) => {
  try {
    const friends = await prisma.friendship.findMany({
      where: { userId: req.user.id },
      include: { friend: { select: userCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    res.json(friends.map((row) => ({ ...row.friend, friendshipCreatedAt: row.createdAt })));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar amigos.', error: err.message });
  }
};

const createStory = async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim().slice(0, 800) : null;
  const uploadedMediaUrl = req.file ? `/uploads/stories/${req.file.filename}` : null;
  const mediaUrl = uploadedMediaUrl || (typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.trim().slice(0, 1000) : null);
  const mediaType = req.file?.mimetype || (typeof req.body.mediaType === 'string' ? req.body.mediaType.trim().slice(0, 80) : null);

  if (!text && !mediaUrl) return res.status(400).json({ message: 'Story precisa de texto ou midia.' });
  if (mediaType && !mediaType.startsWith('image/') && !mediaType.startsWith('video/')) {
    return res.status(400).json({ message: 'Status aceita apenas imagem ou video.' });
  }

  try {
    await prisma.story.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await prisma.story.create({
      data: { userId: req.user.id, text, mediaUrl, mediaType, expiresAt },
      include: { user: { select: userCardSelect } },
    });
    res.status(201).json({ message: 'Status publicado.', story });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao publicar status.', error: err.message });
  }
};

const listStories = async (req, res) => {
  try {
    await prisma.story.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: { select: userCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar status.', error: err.message });
  }
};

const deleteStory = async (req, res) => {
  const storyId = parseId(req.params.id);
  if (!storyId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) return res.status(404).json({ message: 'Status nao encontrado.' });
    if (story.userId !== req.user.id) return res.status(403).json({ message: 'Voce nao pode apagar este status.' });

    await prisma.story.delete({ where: { id: storyId } });
    res.json({ message: 'Status apagado.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao apagar status.', error: err.message });
  }
};

const toggleRepost = async (req, res) => {
  const resumeId = parseId(req.params.id);
  const userId = req.user.id;
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 600) : null;

  if (!resumeId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId }, select: { id: true, userId: true } });
    if (!resume) return res.status(404).json({ message: 'Post nao encontrado.' });

    const existing = await prisma.resumeRepost.findUnique({ where: { userId_resumeId: { userId, resumeId } } });
    let reposted = false;
    if (existing) {
      await prisma.resumeRepost.delete({ where: { userId_resumeId: { userId, resumeId } } });
    } else {
      await prisma.resumeRepost.create({ data: { userId, resumeId, comment } });
      reposted = true;
      await createNotification({
        userId: resume.userId,
        actorId: userId,
        resumeId,
        type: 'REPOST',
        message: 'repostou seu trabalho.',
      });
    }

    const repostCount = await prisma.resumeRepost.count({ where: { resumeId } });
    res.json({ reposted, repostCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao repostar.', error: err.message });
  }
};

const createShare = async (req, res) => {
  const resumeId = parseId(req.params.id);
  const target = typeof req.body.target === 'string' ? req.body.target.trim().slice(0, 80) : null;
  if (!resumeId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId }, select: { id: true, userId: true } });
    if (!resume) return res.status(404).json({ message: 'Post nao encontrado.' });

    await prisma.resumeShare.create({ data: { userId: req.user?.id || null, resumeId, target } });
    if (req.user?.id) {
      await createNotification({
        userId: resume.userId,
        actorId: req.user.id,
        resumeId,
        type: 'SHARE',
        message: 'compartilhou seu trabalho.',
      });
    }

    const shareCount = await prisma.resumeShare.count({ where: { resumeId } });
    res.status(201).json({ message: 'Compartilhamento registrado.', shareCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao compartilhar.', error: err.message });
  }
};

const toggleSaveResume = async (req, res) => {
  const resumeId = parseId(req.params.id);
  const userId = req.user.id;
  if (!resumeId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const existing = await prisma.savedResume.findUnique({ where: { userId_resumeId: { userId, resumeId } } });
    let saved = false;
    if (existing) {
      await prisma.savedResume.delete({ where: { userId_resumeId: { userId, resumeId } } });
    } else {
      const resume = await prisma.resume.findUnique({ where: { id: resumeId }, select: { id: true } });
      if (!resume) return res.status(404).json({ message: 'Post nao encontrado.' });
      await prisma.savedResume.create({ data: { userId, resumeId } });
      saved = true;
    }

    const savedCount = await prisma.savedResume.count({ where: { resumeId } });
    res.json({ saved, savedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao salvar post.', error: err.message });
  }
};

const listSavedResumes = async (req, res) => {
  try {
    const saved = await prisma.savedResume.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        resume: {
          include: {
            user: { select: userCardSelect },
            folder: { include: { category: true } },
            tags: { select: { id: true, name: true } },
            _count: { select: { likes: true, comments: true, reposts: true, shares: true, savedBy: true } },
          },
        },
      },
    });
    res.json(saved.map((row) => row.resume));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar album.', error: err.message });
  }
};

const createContributionRequest = async (req, res) => {
  const resumeId = parseId(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 120) : null;
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 4000) : '';

  if (!resumeId) return res.status(400).json({ message: 'ID invalido.' });
  if (!message) return res.status(400).json({ message: 'Explique sua melhoria para enviar a contribuicao.' });

  try {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId }, select: { id: true, userId: true } });
    if (!resume) return res.status(404).json({ message: 'Post nao encontrado.' });

    const contribution = await prisma.contributionRequest.create({
      data: { resumeId, authorId: req.user.id, ownerId: resume.userId, title, message },
      include: {
        author: { select: userCardSelect },
        owner: { select: userCardSelect },
        resume: { select: { id: true, title: true } },
      },
    });

    await createNotification({
      userId: resume.userId,
      actorId: req.user.id,
      resumeId,
      type: 'CONTRIBUTION',
      message: 'enviou uma sugestao de melhoria no seu trabalho.',
    });

    res.status(201).json({ message: 'Contribuicao enviada.', contribution });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar contribuicao.', error: err.message });
  }
};

const listContributions = async (req, res) => {
  const mode = req.query.mode === 'sent' ? 'sent' : 'received';
  try {
    const contributions = await prisma.contributionRequest.findMany({
      where: mode === 'sent' ? { authorId: req.user.id } : { ownerId: req.user.id },
      include: {
        author: { select: userCardSelect },
        owner: { select: userCardSelect },
        resume: { select: { id: true, title: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(contributions);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar contribuicoes.', error: err.message });
  }
};

const updateContributionStatus = async (req, res) => {
  const contributionId = parseId(req.params.id);
  const status = String(req.body.status || '').toUpperCase();
  if (!contributionId) return res.status(400).json({ message: 'ID invalido.' });
  if (!['ACCEPTED', 'DECLINED', 'PENDING'].includes(status)) {
    return res.status(400).json({ message: 'Status invalido.' });
  }

  try {
    const contribution = await prisma.contributionRequest.findUnique({ where: { id: contributionId } });
    if (!contribution) return res.status(404).json({ message: 'Contribuicao nao encontrada.' });
    if (contribution.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Voce nao pode alterar esta contribuicao.' });
    }

    const updated = await prisma.contributionRequest.update({
      where: { id: contributionId },
      data: { status },
      include: {
        author: { select: userCardSelect },
        resume: { select: { id: true, title: true } },
      },
    });

    await createNotification({
      userId: contribution.authorId,
      actorId: req.user.id,
      resumeId: contribution.resumeId,
      type: 'CONTRIBUTION_STATUS',
      message: `marcou sua contribuicao como ${status.toLowerCase()}.`,
    });

    res.json({ message: 'Contribuicao atualizada.', contribution: updated });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar contribuicao.', error: err.message });
  }
};

const listNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      include: {
        actor: { select: userCardSelect },
        resume: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar notificacoes.', error: err.message });
  }
};

const markNotificationRead = async (req, res) => {
  const notificationId = parseId(req.params.id);
  if (!notificationId) return res.status(400).json({ message: 'ID invalido.' });

  try {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) return res.status(404).json({ message: 'Notificacao nao encontrada.' });
    if (notification.userId !== req.user.id) return res.status(403).json({ message: 'Voce nao pode alterar esta notificacao.' });

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    res.json({ message: 'Notificacao lida.', notification: updated });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar notificacao.', error: err.message });
  }
};

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  createStory,
  listStories,
  deleteStory,
  toggleRepost,
  createShare,
  toggleSaveResume,
  listSavedResumes,
  createContributionRequest,
  listContributions,
  updateContributionStatus,
  listNotifications,
  markNotificationRead,
};
