import dotenv from "dotenv";
import express from "express";
import cors from "cors";

dotenv.config({ path: new URL("../.env", import.meta.url) });
const { auth, db } = await import("./firebaseAdmin.js");

const app = express();
const port = Number(process.env.PORT || 4000);
const appName = "Mega Tweets API";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "6mb" }));

const nowIso = () => new Date().toISOString();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function sanitizeText(input, maxLength = 1200) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, maxLength);
}

function sanitizeDataUrl(input, allowedPrefix, maxLength) {
  if (typeof input !== "string") return "";
  const value = input.trim();
  if (!value) return "";
  if (!value.startsWith(allowedPrefix)) return "";
  if (value.length > maxLength) return "";
  return value;
}

function sanitizeInterests(input, maxItems = 8) {
  if (!Array.isArray(input)) return [];
  const values = input
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean)
    .map((item) => item.slice(0, 30));
  return [...new Set(values)].slice(0, maxItems);
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

const parseIsoMs = (value) => {
  const ms = new Date(value || "").getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

async function isUserViewingContext(uid, context) {
  if (!uid || !context?.type) return false;
  const snap = await db.ref(`presenceViews/${uid}`).get();
  if (!snap.exists()) return false;
  const active = snap.val() || {};
  const isFresh = Date.now() - parseIsoMs(active.updatedAt) < 20_000;
  if (!isFresh) return false;
  if (context.type === "group") {
    return active.type === "group" && active.groupId === context.groupId;
  }
  if (context.type === "dm") {
    return active.type === "dm" && active.otherUid === context.otherUid;
  }
  return false;
}

async function isGroupAdmin(groupId, uid) {
  const snapshot = await db.ref(`groupAdmins/${groupId}/${uid}`).get();
  return snapshot.exists();
}

async function pruneOldGroupMessages(groupId, maxAgeMs = 24 * 60 * 60 * 1000) {
  const snapshot = await db.ref(`groupMessages/${groupId}`).get();
  if (!snapshot.exists()) return;
  const messages = snapshot.val() || {};
  const now = Date.now();
  const removals = Object.entries(messages)
    .filter(([, value]) => {
      const createdAt = new Date(value?.createdAt || "").getTime();
      if (Number.isNaN(createdAt)) return false;
      return now - createdAt > maxAgeMs;
    })
    .map(([id]) => db.ref(`groupMessages/${groupId}/${id}`).remove());
  if (removals.length) await Promise.all(removals);
}

async function syncUserPhotoAcrossContent(uid, photoURL) {
  const updates = {};
  const [tweetsSnap, commentsSnap, groupMessagesSnap, dmSnap] = await Promise.all([
    db.ref("tweets").get(),
    db.ref("tweetComments").get(),
    db.ref("groupMessages").get(),
    db.ref("dms").get(),
  ]);

  const tweets = tweetsSnap.exists() ? tweetsSnap.val() : {};
  Object.entries(tweets).forEach(([tweetId, tweet]) => {
    if (tweet?.authorUid === uid) updates[`tweets/${tweetId}/authorPhotoURL`] = photoURL;
  });

  const tweetComments = commentsSnap.exists() ? commentsSnap.val() : {};
  Object.entries(tweetComments).forEach(([tweetId, tweetCommentMap]) => {
    Object.entries(tweetCommentMap || {}).forEach(([commentId, comment]) => {
      if (comment?.authorUid === uid) updates[`tweetComments/${tweetId}/${commentId}/authorPhotoURL`] = photoURL;
    });
  });

  const groupMessages = groupMessagesSnap.exists() ? groupMessagesSnap.val() : {};
  Object.entries(groupMessages).forEach(([groupId, messageMap]) => {
    Object.entries(messageMap || {}).forEach(([messageId, message]) => {
      if (message?.senderUid === uid) updates[`groupMessages/${groupId}/${messageId}/senderPhotoURL`] = photoURL;
      if (message?.replyTo?.senderUid === uid) {
        updates[`groupMessages/${groupId}/${messageId}/replyTo/senderPhotoURL`] = photoURL;
      }
    });
  });

  const dms = dmSnap.exists() ? dmSnap.val() : {};
  Object.entries(dms).forEach(([conversationKey, messageMap]) => {
    Object.entries(messageMap || {}).forEach(([messageId, message]) => {
      if (message?.senderUid === uid) updates[`dms/${conversationKey}/${messageId}/senderPhotoURL`] = photoURL;
      if (message?.replyTo?.senderUid === uid) {
        updates[`dms/${conversationKey}/${messageId}/replyTo/senderPhotoURL`] = photoURL;
      }
    });
  });

  if (Object.keys(updates).length) {
    await db.ref().update(updates);
  }
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
  res.json({ ok: true, service: "mega-tweets-api", at: nowIso() });
});

app.use("/api", authRequired);

app.get("/api/profiles/me", asyncHandler(async (req, res) => {
  const existing = await getProfile(req.user.uid);

  if (existing) {
    const [followingSnap, followersSnap] = await Promise.all([
      db.ref(`userFollows/${req.user.uid}`).get(),
      db.ref(`userFollowers/${req.user.uid}`).get(),
    ]);
    const followingIds = followingSnap.exists() ? Object.keys(followingSnap.val()) : [];
    const followerCount = followersSnap.exists() ? Object.keys(followersSnap.val()).length : 0;
    return res.json({
      ...existing,
      interests: existing.interests || [],
      followingIds,
      followingCount: followingIds.length,
      followerCount,
    });
  }

  return res.json({
    uid: req.user.uid,
    email: req.user.email || "",
    fullName: "",
    nickname: "",
    bio: "",
    interests: [],
    photoURL: req.user.picture || "",
    followingIds: [],
    followerCount: 0,
    followingCount: 0,
    createdAt: null,
    updatedAt: null,
  });
}));

app.post("/api/profiles/me", asyncHandler(async (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 60);
  const nickname = sanitizeText(req.body?.nickname, 40);
  const bio = sanitizeText(req.body?.bio, 220);
  const interests = sanitizeInterests(req.body?.interests);
  const uploadedPhoto = sanitizeDataUrl(req.body?.photoURL, "data:image/", 1_500_000);

  if (fullName.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters" });
  }
  if (nickname.length < 2) {
    return res.status(400).json({ error: "Nickname must be at least 2 characters" });
  }
  if (!interests.length) {
    return res.status(400).json({ error: "Pick at least one interest" });
  }

  const existing = await getProfile(req.user.uid);
  const nextPhoto = uploadedPhoto || existing?.photoURL || req.user.picture || "";

  const profile = {
    uid: req.user.uid,
    email: req.user.email || "",
    fullName,
    nickname,
    bio,
    interests,
    photoURL: nextPhoto,
    updatedAt: nowIso(),
  };

  if (!existing) {
    profile.createdAt = nowIso();
  } else {
    profile.createdAt = existing.createdAt || nowIso();
  }

  await db.ref(`profiles/${req.user.uid}`).set(profile);
  await syncUserPhotoAcrossContent(req.user.uid, profile.photoURL);
  const [followingSnap, followersSnap] = await Promise.all([
    db.ref(`userFollows/${req.user.uid}`).get(),
    db.ref(`userFollowers/${req.user.uid}`).get(),
  ]);
  const followingIds = followingSnap.exists() ? Object.keys(followingSnap.val()) : [];
  const followerCount = followersSnap.exists() ? Object.keys(followersSnap.val()).length : 0;
  return res.status(201).json({
    ...profile,
    followingIds,
    followingCount: followingIds.length,
    followerCount,
  });
}));

app.get("/api/profiles", asyncHandler(async (req, res) => {
  const [profilesSnap, followsSnap, followersSnap] = await Promise.all([
    db.ref("profiles").get(),
    db.ref("userFollows").get(),
    db.ref("userFollowers").get(),
  ]);
  const profiles = profilesSnap.exists() ? profilesSnap.val() : {};
  const follows = followsSnap.exists() ? followsSnap.val() : {};
  const followers = followersSnap.exists() ? followersSnap.val() : {};
  const myFollowing = follows[req.user.uid] || {};
  const data = Object.values(profiles).map((profile) => ({
    ...profile,
    interests: profile.interests || [],
    isFollowing: Boolean(myFollowing[profile.uid]),
    followerCount: followers[profile.uid] ? Object.keys(followers[profile.uid]).length : 0,
    followingCount: follows[profile.uid] ? Object.keys(follows[profile.uid]).length : 0,
  }));
  return res.json(data);
}));

app.post("/api/profiles/:uid/follow", asyncHandler(async (req, res) => {
  const targetUid = sanitizeText(req.params.uid, 128);
  if (!targetUid || targetUid === req.user.uid) {
    return res.status(400).json({ error: "Invalid user" });
  }
  const targetProfile = await getProfile(targetUid);
  if (!targetProfile) {
    return res.status(404).json({ error: "User not found" });
  }

  const followRef = db.ref(`userFollows/${req.user.uid}/${targetUid}`);
  const followerRef = db.ref(`userFollowers/${targetUid}/${req.user.uid}`);
  const existing = await followRef.get();
  if (existing.exists()) {
    await Promise.all([followRef.remove(), followerRef.remove()]);
    return res.json({ following: false });
  }
  await Promise.all([followRef.set(true), followerRef.set(true)]);
  return res.json({ following: true });
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

app.post("/api/notifications/clear", asyncHandler(async (req, res) => {
  await db.ref(`notifications/${req.user.uid}`).remove();
  return res.json({ ok: true });
}));

app.post("/api/presence/view", asyncHandler(async (req, res) => {
  const type = sanitizeText(req.body?.type, 20);
  const groupId = sanitizeText(req.body?.groupId, 120);
  const otherUid = sanitizeText(req.body?.otherUid, 120);
  const allowedTypes = new Set(["none", "group", "dm"]);
  if (!allowedTypes.has(type)) {
    return res.status(400).json({ error: "Invalid presence type" });
  }

  const payload = {
    type,
    groupId: type === "group" ? groupId : "",
    otherUid: type === "dm" ? otherUid : "",
    updatedAt: nowIso(),
  };
  await db.ref(`presenceViews/${req.user.uid}`).set(payload);
  return res.json({ ok: true });
}));

app.get("/api/tweets", asyncHandler(async (req, res) => {
  const [tweetsSnap, likesSnap, commentsSnap, followSnap, meProfile] = await Promise.all([
    db.ref("tweets").get(),
    db.ref("tweetLikes").get(),
    db.ref("tweetComments").get(),
    db.ref(`userFollows/${req.user.uid}`).get(),
    getProfile(req.user.uid),
  ]);

  const tweets = tweetsSnap.exists() ? tweetsSnap.val() : {};
  const likes = likesSnap.exists() ? likesSnap.val() : {};
  const comments = commentsSnap.exists() ? commentsSnap.val() : {};
  const following = followSnap.exists() ? followSnap.val() : {};
  const interests = sanitizeInterests(meProfile?.interests || []);
  const now = Date.now();

  const scoreTweet = (tweet) => {
    let score = 0;
    if (tweet.authorUid === req.user.uid) score += 80;
    if (following[tweet.authorUid]) score += 120;
    const haystack = `${tweet.content || ""} ${tweet.topic || ""}`.toLowerCase();
    interests.forEach((interest) => {
      if (haystack.includes(interest)) score += 30;
    });
    const ageHours = Math.max(0, (now - new Date(tweet.createdAt).getTime()) / 3_600_000);
    score += Math.max(0, 48 - ageHours);
    return score;
  };

  const result = Object.entries(tweets)
    .map(([id, value]) => ({
      id,
      ...value,
      likesCount: likes[id] ? Object.keys(likes[id]).length : 0,
      likedByMe: Boolean(likes[id]?.[req.user.uid]),
      commentsCount: comments[id] ? Object.keys(comments[id]).length : 0,
      rankScore: scoreTweet(value),
    }))
    .sort((a, b) => {
      if ((b.rankScore || 0) !== (a.rankScore || 0)) return (b.rankScore || 0) - (a.rankScore || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map(({ rankScore, ...tweet }) => tweet);

  return res.json(result);
}));

app.post("/api/tweets", asyncHandler(async (req, res) => {
  const content = sanitizeText(req.body?.content, 6000);
  const topic = sanitizeText(req.body?.topic, 30);
  const imageData = sanitizeDataUrl(req.body?.imageData, "data:image/", 1_500_000);
  const audioData = sanitizeDataUrl(req.body?.audioData, "data:audio/", 3_000_000);
  const videoData = sanitizeDataUrl(req.body?.videoData, "data:video/", 6_500_000);

  if (content.length < 2 && !imageData && !audioData && !videoData) {
    return res.status(400).json({ error: "Tweet text or attachment is required" });
  }

  const profile = await getProfile(req.user.uid);

  if (!profile?.nickname) {
    return res.status(403).json({ error: "Set your nickname before posting" });
  }

  const ref = db.ref("tweets").push();
  const tweet = {
    authorUid: req.user.uid,
    authorNickname: profile.nickname,
    authorPhotoURL: profile.photoURL || req.user.picture || "",
    content,
    imageData,
    audioData,
    videoData,
    topic,
    createdAt: nowIso(),
  };

  await ref.set(tweet);
  return res.status(201).json({ id: ref.key, ...tweet, likesCount: 0, commentsCount: 0 });
}));

app.put("/api/tweets/:tweetId", asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const content = sanitizeText(req.body?.content, 6000);

  if (content.length < 2) {
    return res.status(400).json({ error: "Content must be at least 2 characters" });
  }

  const tweetRef = db.ref(`tweets/${tweetId}`);
  const tweetSnap = await tweetRef.get();
  if (!tweetSnap.exists()) {
    return res.status(404).json({ error: "Tweet not found" });
  }

  const existingTweet = tweetSnap.val();
  if (existingTweet.authorUid !== req.user.uid) {
    return res.status(403).json({ error: "You can edit only your own tweet" });
  }

  const updatedTweet = {
    ...existingTweet,
    content,
    updatedAt: nowIso(),
  };

  await tweetRef.set(updatedTweet);
  return res.json({ id: tweetId, ...updatedTweet });
}));

app.delete("/api/tweets/:tweetId", asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const tweetRef = db.ref(`tweets/${tweetId}`);
  const tweetSnap = await tweetRef.get();
  if (!tweetSnap.exists()) {
    return res.status(404).json({ error: "Tweet not found" });
  }

  const tweet = tweetSnap.val();
  if (tweet.authorUid !== req.user.uid) {
    return res.status(403).json({ error: "You can delete only your own tweet" });
  }

  await Promise.all([
    tweetRef.remove(),
    db.ref(`tweetLikes/${tweetId}`).remove(),
    db.ref(`tweetComments/${tweetId}`).remove(),
    db.ref(`tweetCommentLikes/${tweetId}`).remove(),
  ]);

  return res.json({ ok: true });
}));

app.post("/api/tweets/:tweetId/like", asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const likeRef = db.ref(`tweetLikes/${tweetId}/${req.user.uid}`);
  const likedSnap = await likeRef.get();
  const tweetSnap = await db.ref(`tweets/${tweetId}`).get();

  if (likedSnap.exists()) {
    await likeRef.remove();
  } else {
    await likeRef.set(true);
    if (tweetSnap.exists()) {
      const tweet = tweetSnap.val();
      const actor = await getProfile(req.user.uid);
      if (tweet.authorUid && tweet.authorUid !== req.user.uid) {
        await createNotification(tweet.authorUid, "tweet_like", {
          tweetId,
          actorUid: req.user.uid,
          actorNickname: actor?.nickname || "Someone",
          actorPhotoURL: actor?.photoURL || req.user.picture || "",
        });
      }
    }
  }

  const likesSnap = await db.ref(`tweetLikes/${tweetId}`).get();
  const likesCount = likesSnap.exists() ? Object.keys(likesSnap.val()).length : 0;

  return res.json({ liked: !likedSnap.exists(), likesCount });
}));

app.get("/api/tweets/:tweetId/comments", asyncHandler(async (req, res) => {
  const [commentsSnap, likesSnap] = await Promise.all([
    db.ref(`tweetComments/${req.params.tweetId}`).get(),
    db.ref(`tweetCommentLikes/${req.params.tweetId}`).get(),
  ]);
  const comments = commentsSnap.exists() ? commentsSnap.val() : {};
  const likes = likesSnap.exists() ? likesSnap.val() : {};

  const result = Object.entries(comments)
    .map(([id, value]) => ({
      id,
      ...value,
      likesCount: likes[id] ? Object.keys(likes[id]).length : 0,
      likedByMe: Boolean(likes[id]?.[req.user.uid]),
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/tweets/:tweetId/comments", asyncHandler(async (req, res) => {
  const text = sanitizeText(req.body?.text, 800);
  const parentCommentId = sanitizeText(req.body?.parentCommentId, 120);
  if (text.length < 2) {
    return res.status(400).json({ error: "Comment must be at least 2 characters" });
  }

  const profile = await getProfile(req.user.uid);
  if (!profile?.nickname) {
    return res.status(403).json({ error: "Set your nickname before commenting" });
  }
  const tweetSnap = await db.ref(`tweets/${req.params.tweetId}`).get();
  if (!tweetSnap.exists()) {
    return res.status(404).json({ error: "Tweet not found" });
  }

  const commentRef = db.ref(`tweetComments/${req.params.tweetId}`).push();
  const comment = {
    authorUid: req.user.uid,
    authorNickname: profile.nickname,
    authorPhotoURL: profile.photoURL || req.user.picture || "",
    text,
    parentCommentId: parentCommentId || "",
    createdAt: nowIso(),
  };

  await commentRef.set(comment);
  const tweet = tweetSnap.val();
  if (tweet.authorUid && tweet.authorUid !== req.user.uid) {
    await createNotification(tweet.authorUid, "tweet_comment", {
      tweetId: req.params.tweetId,
      actorUid: req.user.uid,
      actorNickname: profile.nickname,
      actorPhotoURL: profile.photoURL || req.user.picture || "",
      commentText: text.slice(0, 120),
    });
  }
  return res.status(201).json({ id: commentRef.key, ...comment, likesCount: 0, likedByMe: false });
}));

app.post("/api/tweets/:tweetId/comments/:commentId/like", asyncHandler(async (req, res) => {
  const { tweetId, commentId } = req.params;
  const commentSnap = await db.ref(`tweetComments/${tweetId}/${commentId}`).get();
  if (!commentSnap.exists()) {
    return res.status(404).json({ error: "Comment not found" });
  }

  const likeRef = db.ref(`tweetCommentLikes/${tweetId}/${commentId}/${req.user.uid}`);
  const likedSnap = await likeRef.get();
  if (likedSnap.exists()) await likeRef.remove();
  else await likeRef.set(true);

  const likesSnap = await db.ref(`tweetCommentLikes/${tweetId}/${commentId}`).get();
  const likesCount = likesSnap.exists() ? Object.keys(likesSnap.val()).length : 0;

  return res.json({ liked: !likedSnap.exists(), likesCount });
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
    autoDelete24h: false,
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

app.post("/api/groups/:groupId/messages/clear", asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const requesterIsAdmin = await isGroupAdmin(groupId, req.user.uid);
  if (!requesterIsAdmin) {
    return res.status(403).json({ error: "Only admins can clear messages" });
  }
  await db.ref(`groupMessages/${groupId}`).remove();
  return res.json({ ok: true });
}));

app.post("/api/groups/:groupId/settings", asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const requesterIsAdmin = await isGroupAdmin(groupId, req.user.uid);
  if (!requesterIsAdmin) {
    return res.status(403).json({ error: "Only admins can update group settings" });
  }
  const autoDelete24h = req.body?.autoDelete24h === true;
  await db.ref(`groups/${groupId}/autoDelete24h`).set(autoDelete24h);
  return res.json({ ok: true, autoDelete24h });
}));

app.get("/api/groups/:groupId/messages", asyncHandler(async (req, res) => {
  const groupSnap = await db.ref(`groups/${req.params.groupId}`).get();
  if (!groupSnap.exists()) {
    return res.status(404).json({ error: "Group not found" });
  }
  const memberSnap = await db.ref(`groupMembers/${req.params.groupId}/${req.user.uid}`).get();
  if (!memberSnap.exists()) {
    return res.status(403).json({ error: "Join this group to view messages" });
  }
  const group = groupSnap.val() || {};
  if (group.autoDelete24h) await pruneOldGroupMessages(req.params.groupId);

  const snapshot = await db.ref(`groupMessages/${req.params.groupId}`).get();
  const messages = snapshot.exists() ? snapshot.val() : {};

  const result = Object.entries(messages)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return res.json(result);
}));

app.post("/api/groups/:groupId/messages", asyncHandler(async (req, res) => {
  const text = sanitizeText(req.body?.text, 1200);
  const imageData = sanitizeDataUrl(req.body?.imageData, "data:image/", 1_500_000);
  const audioData = sanitizeDataUrl(req.body?.audioData, "data:audio/", 3_000_000);
  const videoData = sanitizeDataUrl(req.body?.videoData, "data:video/", 6_500_000);
  const replyToMessageId = sanitizeText(req.body?.replyToMessageId, 120);
  if (text.length < 1 && !imageData && !audioData && !videoData) {
    return res.status(400).json({ error: "Message or attachment is required" });
  }

  const memberSnap = await db.ref(`groupMembers/${req.params.groupId}/${req.user.uid}`).get();
  if (!memberSnap.exists()) {
    return res.status(403).json({ error: "Join this group before sending messages" });
  }
  const groupSnap = await db.ref(`groups/${req.params.groupId}`).get();
  if (!groupSnap.exists()) {
    return res.status(404).json({ error: "Group not found" });
  }
  const group = groupSnap.val() || {};
  if (group.autoDelete24h) await pruneOldGroupMessages(req.params.groupId);

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
    imageData,
    audioData,
    videoData,
    replyTo,
    createdAt: nowIso(),
  };

  await msgRef.set(message);
  if (replyTo?.senderUid && replyTo.senderUid !== req.user.uid) {
    const isActiveInGroup = await isUserViewingContext(replyTo.senderUid, {
      type: "group",
      groupId: req.params.groupId,
    });
    if (!isActiveInGroup) {
      const replyPreview = text || (imageData ? "Sent an image" : (videoData ? "Sent a video" : "Sent a voice message"));
      await createNotification(replyTo.senderUid, "group_reply", {
        groupId: req.params.groupId,
        messageId: msgRef.key,
        repliedToMessageId: replyToMessageId,
        actorUid: req.user.uid,
        actorNickname: profile?.nickname || "Unknown",
        actorPhotoURL: profile?.photoURL || req.user.picture || "",
        messageText: replyPreview.slice(0, 120),
      });
    }
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
  const imageData = sanitizeDataUrl(req.body?.imageData, "data:image/", 1_500_000);
  const audioData = sanitizeDataUrl(req.body?.audioData, "data:audio/", 3_000_000);
  const videoData = sanitizeDataUrl(req.body?.videoData, "data:video/", 6_500_000);
  const replyToMessageId = sanitizeText(req.body?.replyToMessageId, 120);

  if (text.length < 1 && !imageData && !audioData && !videoData) {
    return res.status(400).json({ error: "Message or attachment is required" });
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
    imageData,
    audioData,
    videoData,
    replyTo,
    createdAt: nowIso(),
  };

  await msgRef.set(message);
  if (replyTo?.senderUid && replyTo.senderUid !== req.user.uid) {
    const isActiveInDm = await isUserViewingContext(replyTo.senderUid, {
      type: "dm",
      otherUid: req.user.uid,
    });
    if (!isActiveInDm) {
      const replyPreview = text || (imageData ? "Sent an image" : (videoData ? "Sent a video" : "Sent a voice message"));
      await createNotification(replyTo.senderUid, "dm_reply", {
        messageId: msgRef.key,
        repliedToMessageId: replyToMessageId,
        actorUid: req.user.uid,
        actorNickname: senderProfile?.nickname || "Unknown",
        actorPhotoURL: senderProfile?.photoURL || req.user.picture || "",
        messageText: replyPreview.slice(0, 120),
      });
    }
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
