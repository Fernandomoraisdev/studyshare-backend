const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const toPublicUser = (user) => {
  if (!user) return null;
  // Remover senha por segurança
  // (Prisma retorna campos do modelo; sempre sanitize antes de enviar)
  const { password, ...rest } = user;
  return rest;
};

const toUserCard = (user, viewerFollowingIdsSet) => ({
  id: user.id,
  name: user.name,
  area: user.area,
  photoUrl: user.photoUrl,
  coverUrl: user.coverUrl,
  bio: user.bio,
  isFollowing: viewerFollowingIdsSet ? viewerFollowingIdsSet.has(user.id) : false,
});

const getProfile = async (req, res) => {
  try {
    const [user, followersCount, followingCount, friendsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          resumes: {
            orderBy: { createdAt: 'desc' },
            include: {
              folder: { include: { category: true } },
              tags: { select: { id: true, name: true } },
              _count: { select: { likes: true, comments: true, reposts: true, shares: true, savedBy: true, contributionRequests: true } },
            },
          },
        },
      }),
      prisma.userFollow.count({ where: { followingId: req.user.id } }),
      prisma.userFollow.count({ where: { followerId: req.user.id } }),
      prisma.friendship.count({ where: { userId: req.user.id } }),
    ]);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    res.json({ ...toPublicUser(user), followersCount, followingCount, friendsCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar perfil.', error: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { name, bio, area, photoUrl, coverUrl } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, bio, area, photoUrl, coverUrl }
    });
    res.json({ message: 'Perfil atualizado!', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar perfil.', error: err.message });
  }
};

const uploadProfilePhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhuma foto enviada.' });
  }

  const photoUrl = `/uploads/profiles/${req.file.filename}`;

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl },
    });

    res.json({ message: 'Foto atualizada!', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar foto.', error: err.message });
  }
};

const getUserSummary = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const viewerUserId = req.user?.id;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const [user, followersCount, followingCount, friendsCount, followRecord, friendshipRecord] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true, bio: true, createdAt: true },
      }),
      prisma.userFollow.count({ where: { followingId: userId } }),
      prisma.userFollow.count({ where: { followerId: userId } }),
      prisma.friendship.count({ where: { userId } }),
      viewerUserId
        ? prisma.userFollow.findUnique({
            where: { followerId_followingId: { followerId: viewerUserId, followingId: userId } },
          })
        : null,
      viewerUserId
        ? prisma.friendship.findUnique({
            where: { userId_friendId: { userId: viewerUserId, friendId: userId } },
          })
        : null,
    ]);

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    res.json({
      ...user,
      followersCount,
      followingCount,
      friendsCount,
      isFollowing: Boolean(followRecord),
      isFriend: Boolean(friendshipRecord),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar resumo do perfil.', error: err.message });
  }
};

const getPublicProfile = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const viewerUserId = req.user?.id;
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const [user, followersCount, followingCount, friendsCount, followRecord, friendshipRecord] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          resumes: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              folder: { include: { category: true } },
              tags: { select: { id: true, name: true } },
              _count: { select: { likes: true, comments: true, reposts: true, shares: true, savedBy: true, contributionRequests: true } },
            },
          },
        },
      }),
      prisma.userFollow.count({ where: { followingId: userId } }),
      prisma.userFollow.count({ where: { followerId: userId } }),
      prisma.friendship.count({ where: { userId } }),
      viewerUserId
        ? prisma.userFollow.findUnique({
            where: { followerId_followingId: { followerId: viewerUserId, followingId: userId } },
          })
        : null,
      viewerUserId
        ? prisma.friendship.findUnique({
            where: { userId_friendId: { userId: viewerUserId, friendId: userId } },
          })
        : null,
    ]);

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    res.json({
      ...toPublicUser(user),
      followersCount,
      followingCount,
      friendsCount,
      isFollowing: Boolean(followRecord),
      isFriend: Boolean(friendshipRecord),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar perfil público.', error: err.message });
  }
};

const listFollowers = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const viewerUserId = req.user?.id;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const targetExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetExists) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const rows = await prisma.userFollow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        follower: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true, bio: true } },
      },
    });

    const users = rows.map((r) => r.follower);

    let viewerFollowingIdsSet = null;
    if (viewerUserId && users.length > 0) {
      const followRows = await prisma.userFollow.findMany({
        where: { followerId: viewerUserId, followingId: { in: users.map((u) => u.id) } },
        select: { followingId: true },
      });
      viewerFollowingIdsSet = new Set(followRows.map((r) => r.followingId));
    }

    res.json(users.map((u) => toUserCard(u, viewerFollowingIdsSet)));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar seguidores.', error: err.message });
  }
};

const listFollowing = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const viewerUserId = req.user?.id;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const targetExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetExists) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        following: { select: { id: true, name: true, area: true, photoUrl: true, coverUrl: true, bio: true } },
      },
    });

    const users = rows.map((r) => r.following);

    let viewerFollowingIdsSet = null;
    if (viewerUserId && users.length > 0) {
      const followRows = await prisma.userFollow.findMany({
        where: { followerId: viewerUserId, followingId: { in: users.map((u) => u.id) } },
        select: { followingId: true },
      });
      viewerFollowingIdsSet = new Set(followRows.map((r) => r.followingId));
    }

    res.json(users.map((u) => toUserCard(u, viewerFollowingIdsSet)));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar seguindo.', error: err.message });
  }
};

const toggleFollow = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  const viewerUserId = req.user.id;

  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  if (targetUserId === viewerUserId) {
    return res.status(400).json({ message: 'Você não pode seguir a si mesmo.' });
  }

  try {
    const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetExists) return res.status(404).json({ message: 'Usuário não encontrado.' });

    const existing = await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: viewerUserId, followingId: targetUserId } },
    });

    let following = false;
    if (existing) {
      await prisma.userFollow.delete({
        where: { followerId_followingId: { followerId: viewerUserId, followingId: targetUserId } },
      });
      following = false;
    } else {
      await prisma.userFollow.create({
        data: { followerId: viewerUserId, followingId: targetUserId },
      });
      following = true;
    }

    const followersCount = await prisma.userFollow.count({ where: { followingId: targetUserId } });
    res.json({ following, followersCount });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao seguir usuário.', error: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getUserSummary,
  getPublicProfile,
  listFollowers,
  listFollowing,
  toggleFollow,
};
