import dotenv from "dotenv";
import express from "express";
import cors from "cors";

dotenv.config({ path: new URL("../.env", import.meta.url) });
const { auth, db } = await import("./firebaseAdmin.js");

const app = express();
const port = Number(process.env.PORT || 4000);
const appName = "Mega Novels API";
const ALLOWED_LANGUAGES = [
  "English",
  "Arabic",
  "French",
  "Spanish",
  "German",
  "Portuguese",
  "Italian",
  "Turkish",
  "Hindi",
  "Urdu",
  "Japanese",
  "Korean",
  "Chinese",
  "Russian",
];

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "1mb" }));

const nowIso = () => new Date().toISOString();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function sanitizeText(input, maxLength = 1200) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, maxLength);
}

function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

function createInviteCode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildBaseUrl(req) {
  return process.env.CORS_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

async function getProfile(uid) {
  const snapshot = await db.ref(`profiles/${uid}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

async function createNotification(targetUid, type, payload) {
  if (!targetUid) {
    return;
  }
  const ref = db.ref(`notifications/${targetUid}`).push();
  await ref.set({
    type,
    ...payload,
    read: false,
    createdAt: nowIso(),
  });
}

async function isGroupAdmin(groupId, uid) {
  const snapshot = await db.ref(`groupAdmins/${groupId}/${uid}`).get();
  return snapshot.exists();
}

const authRequired = asyncHandler(async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid auth token" });
  }
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "mega-novels-api", at: nowIso(), allowedLanguages: ALLOWED_LANGUAGES });
});

app.use("/api", authRequired);

app.get("/api/profiles/me", asyncHandler(async (req, res) => {
  const existing = await getProfile(req.user.uid);

  if (existing) {
    return res.json(existing);
  }

  return res.json({
    uid: req.user.uid,
    email: req.user.email || "",
    fullName: "",
    nickname: "",
    bio: "",
    photoURL: req.user.picture || "",
    createdAt: null,
    updatedAt: null,
  });
}));

app.post("/api/profiles/me", asyncHandler(async (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 60);
  const nickname = sanitizeText(req.body?.nickname, 40);
  const bio = sanitizeText(req.body?.bio, 220);

  if (fullName.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters" });
  }
  if (nickname.length < 2) {
    return res.status(400).json({ error: "Nickname must be at least 2 characters" });
  }

  const profile = {
    uid: req.user.uid,
    email: req.user.email || "",
    fullName,
    nickname,
    bio,
    photoURL: req.user.picture || "",
    updatedAt: nowIso(),
  };

  const existing = await getProfile(req.user.uid);

  if (!existing) {
    profile.createdAt = nowIso();
  } else {
    profile.createdAt = existing.createdAt || nowIso();
  }

  await db.ref(`profiles/${req.user.uid}`).set(profile);
  return res.status(201).json(profile);
}));

app.get("/api/profiles", asyncHandler(async (_, res) => {
  const snapshot = await db.ref("profiles").get();
  const data = snapshot.exists() ? Object.values(snapshot.val()) : [];
  return res.json(data);
}));

app.get("/api/notifications", asyncHandler(async (req, res) => {
  const snapshot = await db.ref(`notifications/${req.user.uid}`).get();
  const notifications = snapshot.exists() ? snapshot.val() : {};
  const result = Object.entries(notifications)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(result);
}));

app.post("/api/notifications/read", asyncHandler(async (req, res) => {
  const notificationId = sanitizeText(req.body?.notificationId, 120);
  if (!notificationId) {
    return res.status(400).json({ error: "notificationId is required" });
  }
  await db.ref(`notifications/${req.user.uid}/${notificationId}/read`).set(true);
  return res.json({ ok: true });
}));

app.get("/api/novels", asyncHandler(async (_, res) => {
  const [novelsSnap, likesSnap, commentsSnap] = await Promise.all([
    db.ref("novels").get(),
    db.ref("novelLikes").get(),
    db.ref("novelComments").get(),
  ]);

  const novels = novelsSnap.exists() ? novelsSnap.val() : {};
  const likes = likesSnap.exists() ? likesSnap.val() : {};
  const comments = commentsSnap.exists() ? commentsSnap.val() : {};

  const result = Object.entries(novels)
    .map(([id, value]) => ({
      id,
      ...value,
      likesCount: likes[id] ? Object.keys(likes[id]).length : 0,
      commentsCount: comments[id] ? Object.keys(comments[id]).length : 0,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/novels", asyncHandler(async (req, res) => {
  const title = sanitizeText(req.body?.title, 120);
  const language = sanitizeText(req.body?.language, 30);
  const content = sanitizeText(req.body?.content, 6000);
  const matchedLanguage = ALLOWED_LANGUAGES.find(
    (item) => item.toLowerCase() === language.toLowerCase(),
  );

  if (!title || !language || content.length < 20) {
    return res.status(400).json({ error: "Title, language, and content (20+ chars) are required" });
  }
  if (!matchedLanguage) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const profile = await getProfile(req.user.uid);

  if (!profile?.nickname) {
    return res.status(403).json({ error: "Set your nickname before posting" });
  }

  const ref = db.ref("novels").push();
  const novel = {
    authorUid: req.user.uid,
    authorNickname: profile.nickname,
    authorPhotoURL: profile.photoURL || req.user.picture || "",
    title,
    language: matchedLanguage,
    content,
    createdAt: nowIso(),
  };

  await ref.set(novel);
  return res.status(201).json({ id: ref.key, ...novel, likesCount: 0, commentsCount: 0 });
}));

app.put("/api/novels/:novelId", asyncHandler(async (req, res) => {
  const { novelId } = req.params;
  const title = sanitizeText(req.body?.title, 120);
  const language = sanitizeText(req.body?.language, 30);
  const content = sanitizeText(req.body?.content, 6000);
  const matchedLanguage = ALLOWED_LANGUAGES.find(
    (item) => item.toLowerCase() === language.toLowerCase(),
  );

  if (!title || !language || content.length < 20) {
    return res.status(400).json({ error: "Title, language, and content (20+ chars) are required" });
  }
  if (!matchedLanguage) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  const novelRef = db.ref(`novels/${novelId}`);
  const novelSnap = await novelRef.get();
  if (!novelSnap.exists()) {
    return res.status(404).json({ error: "Novel not found" });
  }

  const existingNovel = novelSnap.val();
  if (existingNovel.authorUid !== req.user.uid) {
    return res.status(403).json({ error: "You can edit only your own novel" });
  }

  const updatedNovel = {
    ...existingNovel,
    title,
    language: matchedLanguage,
    content,
    updatedAt: nowIso(),
  };

  await novelRef.set(updatedNovel);
  return res.json({ id: novelId, ...updatedNovel });
}));

app.delete("/api/novels/:novelId", asyncHandler(async (req, res) => {
  const { novelId } = req.params;
  const novelRef = db.ref(`novels/${novelId}`);
  const novelSnap = await novelRef.get();
  if (!novelSnap.exists()) {
    return res.status(404).json({ error: "Novel not found" });
  }

  const novel = novelSnap.val();
  if (novel.authorUid !== req.user.uid) {
    return res.status(403).json({ error: "You can delete only your own novel" });
  }

  await Promise.all([
    novelRef.remove(),
    db.ref(`novelLikes/${novelId}`).remove(),
    db.ref(`novelComments/${novelId}`).remove(),
  ]);

  return res.json({ ok: true });
}));

app.post("/api/novels/:novelId/like", asyncHandler(async (req, res) => {
  const { novelId } = req.params;
  const likeRef = db.ref(`novelLikes/${novelId}/${req.user.uid}`);
  const likedSnap = await likeRef.get();
  const novelSnap = await db.ref(`novels/${novelId}`).get();

  if (likedSnap.exists()) {
    await likeRef.remove();
  } else {
    await likeRef.set(true);
    if (novelSnap.exists()) {
      const novel = novelSnap.val();
      const actor = await getProfile(req.user.uid);
      if (novel.authorUid && novel.authorUid !== req.user.uid) {
        await createNotification(novel.authorUid, "novel_like", {
          novelId,
          novelTitle: novel.title || "",
          actorUid: req.user.uid,
          actorNickname: actor?.nickname || "Someone",
        });
      }
    }
  }

  const likesSnap = await db.ref(`novelLikes/${novelId}`).get();
  const likesCount = likesSnap.exists() ? Object.keys(likesSnap.val()).length : 0;

  return res.json({ liked: !likedSnap.exists(), likesCount });
}));

app.get("/api/novels/:novelId/comments", asyncHandler(async (req, res) => {
  const snapshot = await db.ref(`novelComments/${req.params.novelId}`).get();
  const comments = snapshot.exists() ? snapshot.val() : {};

  const result = Object.entries(comments)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/novels/:novelId/comments", asyncHandler(async (req, res) => {
  const text = sanitizeText(req.body?.text, 800);
  if (text.length < 2) {
    return res.status(400).json({ error: "Comment must be at least 2 characters" });
  }

  const profile = await getProfile(req.user.uid);
  if (!profile?.nickname) {
    return res.status(403).json({ error: "Set your nickname before commenting" });
  }
  const novelSnap = await db.ref(`novels/${req.params.novelId}`).get();
  if (!novelSnap.exists()) {
    return res.status(404).json({ error: "Novel not found" });
  }

  const commentRef = db.ref(`novelComments/${req.params.novelId}`).push();
  const comment = {
    authorUid: req.user.uid,
    authorNickname: profile.nickname,
    authorPhotoURL: profile.photoURL || req.user.picture || "",
    text,
    createdAt: nowIso(),
  };

  await commentRef.set(comment);
  const novel = novelSnap.val();
  if (novel.authorUid && novel.authorUid !== req.user.uid) {
    await createNotification(novel.authorUid, "novel_comment", {
      novelId: req.params.novelId,
      novelTitle: novel.title || "",
      actorUid: req.user.uid,
      actorNickname: profile.nickname,
      commentText: text.slice(0, 120),
    });
  }
  return res.status(201).json({ id: commentRef.key, ...comment });
}));

app.get("/api/groups", asyncHandler(async (req, res) => {
  const [groupsSnap, membersSnap, adminsSnap] = await Promise.all([
    db.ref("groups").get(),
    db.ref("groupMembers").get(),
    db.ref("groupAdmins").get(),
  ]);

  const groups = groupsSnap.exists() ? groupsSnap.val() : {};
  const members = membersSnap.exists() ? membersSnap.val() : {};
  const admins = adminsSnap.exists() ? adminsSnap.val() : {};
  const baseUrl = buildBaseUrl(req);

  const result = Object.entries(groups)
    .map(([id, value]) => ({
      id,
      ...value,
      membersCount: members[id] ? Object.keys(members[id]).length : 0,
      joined: Boolean(members[id]?.[req.user.uid]),
      isAdmin: Boolean(admins[id]?.[req.user.uid]),
      adminsCount: admins[id] ? Object.keys(admins[id]).length : 0,
      inviteLink: value.inviteCode ? `${baseUrl}/join-group/${value.inviteCode}` : "",
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/groups", asyncHandler(async (req, res) => {
  const name = sanitizeText(req.body?.name, 50);
  const description = sanitizeText(req.body?.description, 240);

  if (name.length < 3) {
    return res.status(400).json({ error: "Group name must be at least 3 characters" });
  }

  const profile = await getProfile(req.user.uid);
  if (!profile?.nickname) {
    return res.status(403).json({ error: "Set your nickname before creating groups" });
  }

  const groupRef = db.ref("groups").push();
  const group = {
    name,
    description,
    creatorUid: req.user.uid,
    creatorNickname: profile.nickname,
    inviteCode: createInviteCode(),
    createdAt: nowIso(),
  };

  await Promise.all([
    groupRef.set(group),
    db.ref(`groupMembers/${groupRef.key}/${req.user.uid}`).set(true),
    db.ref(`groupAdmins/${groupRef.key}/${req.user.uid}`).set(true),
  ]);

  return res.status(201).json({
    id: groupRef.key,
    ...group,
    membersCount: 1,
    joined: true,
    isAdmin: true,
    adminsCount: 1,
    inviteLink: `${buildBaseUrl(req)}/join-group/${group.inviteCode}`,
  });
}));

app.post("/api/groups/:groupId/join", asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const memberRef = db.ref(`groupMembers/${groupId}/${req.user.uid}`);
  const memberSnap = await memberRef.get();

  if (memberSnap.exists()) {
    const isAdmin = await isGroupAdmin(groupId, req.user.uid);
    if (isAdmin) {
      const adminsSnap = await db.ref(`groupAdmins/${groupId}`).get();
      const adminIds = adminsSnap.exists() ? Object.keys(adminsSnap.val()) : [];
      if (adminIds.length === 1) {
        const confirmDelete = req.body?.confirmDelete === true;
        if (!confirmDelete) {
          return res.status(409).json({
            error: "You are the only admin. Confirm leaving to delete this group.",
            requiresConfirmDelete: true,
          });
        }
        await Promise.all([
          db.ref(`groups/${groupId}`).remove(),
          db.ref(`groupMembers/${groupId}`).remove(),
          db.ref(`groupAdmins/${groupId}`).remove(),
          db.ref(`groupMessages/${groupId}`).remove(),
        ]);
        return res.json({ joined: false, deleted: true, membersCount: 0, adminsCount: 0 });
      }
      await db.ref(`groupAdmins/${groupId}/${req.user.uid}`).remove();
    }
    await memberRef.remove();
  } else {
    await memberRef.set(true);
  }

  const [membersSnap, adminsSnap] = await Promise.all([
    db.ref(`groupMembers/${groupId}`).get(),
    db.ref(`groupAdmins/${groupId}`).get(),
  ]);
  const membersCount = membersSnap.exists() ? Object.keys(membersSnap.val()).length : 0;
  const adminsCount = adminsSnap.exists() ? Object.keys(adminsSnap.val()).length : 0;

  return res.json({ joined: !memberSnap.exists(), membersCount, adminsCount });
}));

app.post("/api/groups/join-by-code", asyncHandler(async (req, res) => {
  const inviteCode = sanitizeText(req.body?.inviteCode, 20).toUpperCase();
  if (!inviteCode) {
    return res.status(400).json({ error: "Invite code is required" });
  }

  const groupsSnap = await db.ref("groups").get();
  const groups = groupsSnap.exists() ? groupsSnap.val() : {};
  const found = Object.entries(groups).find(([, value]) => value.inviteCode === inviteCode);

  if (!found) {
    return res.status(404).json({ error: "Invite code is invalid" });
  }

  const [groupId] = found;
  await db.ref(`groupMembers/${groupId}/${req.user.uid}`).set(true);
  return res.json({ ok: true, groupId });
}));

app.get("/api/groups/:groupId/members", asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const memberSnap = await db.ref(`groupMembers/${groupId}/${req.user.uid}`).get();
  if (!memberSnap.exists()) {
    return res.status(403).json({ error: "Join this group first" });
  }

  const [membersSnap, adminsSnap, profilesSnap] = await Promise.all([
    db.ref(`groupMembers/${groupId}`).get(),
    db.ref(`groupAdmins/${groupId}`).get(),
    db.ref("profiles").get(),
  ]);

  const members = membersSnap.exists() ? Object.keys(membersSnap.val()) : [];
  const admins = adminsSnap.exists() ? adminsSnap.val() : {};
  const profiles = profilesSnap.exists() ? profilesSnap.val() : {};

  const result = members.map((uid) => ({
    uid,
    nickname: profiles[uid]?.nickname || "Unknown",
    fullName: profiles[uid]?.fullName || "",
    photoURL: profiles[uid]?.photoURL || "",
    isAdmin: Boolean(admins[uid]),
  }));

  return res.json(result);
}));

app.post("/api/groups/:groupId/admins/:memberUid", asyncHandler(async (req, res) => {
  const { groupId, memberUid } = req.params;
  const requesterIsAdmin = await isGroupAdmin(groupId, req.user.uid);
  if (!requesterIsAdmin) {
    return res.status(403).json({ error: "Only admins can promote members" });
  }

  const memberSnap = await db.ref(`groupMembers/${groupId}/${memberUid}`).get();
  if (!memberSnap.exists()) {
    return res.status(404).json({ error: "Member not found in this group" });
  }

  await db.ref(`groupAdmins/${groupId}/${memberUid}`).set(true);
  return res.json({ ok: true });
}));

app.post("/api/groups/:groupId/remove/:memberUid", asyncHandler(async (req, res) => {
  const { groupId, memberUid } = req.params;
  const requesterIsAdmin = await isGroupAdmin(groupId, req.user.uid);
  if (!requesterIsAdmin) {
    return res.status(403).json({ error: "Only admins can remove members" });
  }
  if (memberUid === req.user.uid) {
    return res.status(400).json({ error: "Use leave action to remove yourself" });
  }

  await Promise.all([
    db.ref(`groupMembers/${groupId}/${memberUid}`).remove(),
    db.ref(`groupAdmins/${groupId}/${memberUid}`).remove(),
  ]);
  return res.json({ ok: true });
}));

app.get("/api/groups/:groupId/messages", asyncHandler(async (req, res) => {
  const memberSnap = await db.ref(`groupMembers/${req.params.groupId}/${req.user.uid}`).get();
  if (!memberSnap.exists()) {
    return res.status(403).json({ error: "Join this group to view messages" });
  }

  const snapshot = await db.ref(`groupMessages/${req.params.groupId}`).get();
  const messages = snapshot.exists() ? snapshot.val() : {};

  const result = Object.entries(messages)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/groups/:groupId/messages", asyncHandler(async (req, res) => {
  const text = sanitizeText(req.body?.text, 1200);
  const replyToMessageId = sanitizeText(req.body?.replyToMessageId, 120);
  if (text.length < 1) {
    return res.status(400).json({ error: "Message is required" });
  }

  const memberSnap = await db.ref(`groupMembers/${req.params.groupId}/${req.user.uid}`).get();
  if (!memberSnap.exists()) {
    return res.status(403).json({ error: "Join this group before sending messages" });
  }

  const profile = await getProfile(req.user.uid);
  const msgRef = db.ref(`groupMessages/${req.params.groupId}`).push();
  let replyTo = null;
  if (replyToMessageId) {
    const replySnap = await db.ref(`groupMessages/${req.params.groupId}/${replyToMessageId}`).get();
    if (replySnap.exists()) {
      const target = replySnap.val();
      replyTo = {
        messageId: replyToMessageId,
        senderUid: target.senderUid || "",
        senderNickname: target.senderNickname || "User",
        text: sanitizeText(target.text || "", 120),
      };
    }
  }
  const message = {
    senderUid: req.user.uid,
    senderNickname: profile?.nickname || "Unknown",
    senderPhotoURL: profile?.photoURL || req.user.picture || "",
    text,
    replyTo,
    createdAt: nowIso(),
  };

  await msgRef.set(message);
  if (replyTo?.senderUid && replyTo.senderUid !== req.user.uid) {
    await createNotification(replyTo.senderUid, "group_reply", {
      groupId: req.params.groupId,
      actorUid: req.user.uid,
      actorNickname: profile?.nickname || "Unknown",
      messageText: text.slice(0, 120),
    });
  }
  return res.status(201).json({ id: msgRef.key, ...message });
}));

app.get("/api/dms/:otherUid", asyncHandler(async (req, res) => {
  const convoId = conversationId(req.user.uid, req.params.otherUid);
  const snapshot = await db.ref(`dms/${convoId}`).get();
  const messages = snapshot.exists() ? snapshot.val() : {};

  const result = Object.entries(messages)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/dms/:otherUid", asyncHandler(async (req, res) => {
  const otherUid = req.params.otherUid;
  const text = sanitizeText(req.body?.text, 1200);
  const replyToMessageId = sanitizeText(req.body?.replyToMessageId, 120);

  if (text.length < 1) {
    return res.status(400).json({ error: "Message is required" });
  }

  const receiverProfile = await getProfile(otherUid);
  if (!receiverProfile) {
    return res.status(404).json({ error: "User not found" });
  }

  const senderProfile = await getProfile(req.user.uid);
  const convoId = conversationId(req.user.uid, otherUid);
  const msgRef = db.ref(`dms/${convoId}`).push();
  let replyTo = null;
  if (replyToMessageId) {
    const replySnap = await db.ref(`dms/${convoId}/${replyToMessageId}`).get();
    if (replySnap.exists()) {
      const target = replySnap.val();
      replyTo = {
        messageId: replyToMessageId,
        senderUid: target.senderUid || "",
        senderNickname: target.senderNickname || "User",
        text: sanitizeText(target.text || "", 120),
      };
    }
  }

  const message = {
    senderUid: req.user.uid,
    receiverUid: otherUid,
    senderNickname: senderProfile?.nickname || "Unknown",
    senderPhotoURL: senderProfile?.photoURL || req.user.picture || "",
    text,
    replyTo,
    createdAt: nowIso(),
  };

  await msgRef.set(message);
  if (replyTo?.senderUid && replyTo.senderUid !== req.user.uid) {
    await createNotification(replyTo.senderUid, "dm_reply", {
      actorUid: req.user.uid,
      actorNickname: senderProfile?.nickname || "Unknown",
      messageText: text.slice(0, 120),
    });
  }
  return res.status(201).json({ id: msgRef.key, ...message });
}));

app.use((err, req, res, _next) => {
  console.error(`[${appName}]`, req.method, req.path, err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`${appName} running on http://localhost:${port}`);
});
