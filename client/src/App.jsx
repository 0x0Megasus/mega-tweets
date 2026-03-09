import { useCallback, useEffect, useMemo, useState } from "react";
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithPopup, signOut } from "firebase/auth";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { auth, googleProvider } from "./firebase";
import { api } from "./api";
import "./App.css";
import TopNav from "./components/TopNav";
import AuthLanding from "./components/AuthLanding";
import SetupProfile from "./components/SetupProfile";
import FeedView from "./components/FeedView";
import GroupsView from "./components/GroupsView";
import DmView from "./components/DmView";
import NotificationsView from "./components/NotificationsView";
import ProfileView from "./components/ProfileView";
import ConfirmLeaveModal from "./components/ConfirmLeaveModal";
import PublishNovelModal from "./components/PublishNovelModal";
import NotFoundPage from "./components/NotFoundPage";

const TABS = ["feed", "groups", "dm", "notifications", "profile"];

const containsArabic = (t) => /[\u0600-\u06FF]/.test(t || "");
const notifText = (n) => {
  if (n.type === "novel_like") return `${n.actorNickname || "Someone"} liked your tweet`;
  if (n.type === "novel_comment") return `${n.actorNickname || "Someone"} replied to your tweet`;
  if (n.type === "group_reply") return `${n.actorNickname || "Someone"} replied to your group message`;
  if (n.type === "dm_reply") return `${n.actorNickname || "Someone"} replied in DM`;
  return "New activity";
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [bootLoading, setBootLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 960);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [focusedPostId, setFocusedPostId] = useState("");
  const [seenPostIds, setSeenPostIds] = useState({});
  const [setupNickname, setSetupNickname] = useState("");
  const [setupBio, setSetupBio] = useState("");
  const [profileDraft, setProfileDraft] = useState({ nickname: "", bio: "" });

  const [novels, setNovels] = useState([]);
  const [commentCache, setCommentCache] = useState({});
  const [postContent, setPostContent] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editContent, setEditContent] = useState("");

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupReplyTo, setGroupReplyTo] = useState(null);
  const [groupSending, setGroupSending] = useState(false);
  const [groupImageData, setGroupImageData] = useState("");
  const [groupAudioData, setGroupAudioData] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [pendingLeaveGroupId, setPendingLeaveGroupId] = useState("");
  const [mobileGroupPage, setMobileGroupPage] = useState("list");
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMessagesLoading, setGroupMessagesLoading] = useState(false);

  const [dmTargetUid, setDmTargetUid] = useState("");
  const [dmMessages, setDmMessages] = useState([]);
  const [dmDraft, setDmDraft] = useState("");
  const [dmReplyTo, setDmReplyTo] = useState(null);
  const [dmSending, setDmSending] = useState(false);
  const [dmImageData, setDmImageData] = useState("");
  const [dmAudioData, setDmAudioData] = useState("");
  const [mobileDmPage, setMobileDmPage] = useState("list");
  const [dmMessagesLoading, setDmMessagesLoading] = useState(false);
  const [likeLoadingId, setLikeLoadingId] = useState("");
  const [commentLoadingId, setCommentLoadingId] = useState("");

  const currentTab = useMemo(() => {
    const firstSegment = location.pathname.split("/")[1];
    return TABS.includes(firstSegment) ? firstSegment : "feed";
  }, [location.pathname]);

  const busy = pendingCount > 0;
  const checking = authLoading || (Boolean(firebaseUser) && bootLoading);
  const formatters = useMemo(() => ({
    timeOnly: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }),
    dateTime: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }), []);
  const timeAgo = useCallback((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay = now.getFullYear() === date.getFullYear()
      && now.getMonth() === date.getMonth()
      && now.getDate() === date.getDate();

    return sameDay ? formatters.timeOnly.format(date) : formatters.dateTime.format(date);
  }, [formatters]);

  const selectedGroupData = useMemo(() => groups.find((g) => g.id === selectedGroup), [groups, selectedGroup]);
  const others = useMemo(() => users.filter((u) => u.uid !== profile?.uid && u.nickname), [users, profile]);
  const isGroupChatVisible = currentTab === "groups" && (!isMobile || mobileGroupPage === "chat");
  const isDmChatVisible = currentTab === "dm" && (!isMobile || mobileDmPage === "chat");
  const unreadNotificationsCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const unseenFeedCount = useMemo(() => novels.filter((n) => !seenPostIds[n.id]).length, [novels, seenPostIds]);
  const badgeCounts = useMemo(
    () => ({ feed: unseenFeedCount, notifications: unreadNotificationsCount }),
    [unseenFeedCount, unreadNotificationsCount],
  );

  useEffect(() => {
    if (!profile?.uid) { setSeenPostIds({}); return; }
    const storageKey = `mega_tweets_seen_posts_${profile.uid}`;
    try {
      const raw = localStorage.getItem(storageKey);
      setSeenPostIds(raw ? JSON.parse(raw) : {});
    } catch {
      setSeenPostIds({});
    }
  }, [profile?.uid]);

  const markPostsSeen = (postIds) => {
    if (!profile?.uid || !postIds.length) return;
    const storageKey = `mega_tweets_seen_posts_${profile.uid}`;
    setSeenPostIds((prev) => {
      let changed = false;
      const next = { ...prev };
      postIds.forEach((id) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      });
      if (changed) localStorage.setItem(storageKey, JSON.stringify(next));
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    if (currentTab !== "feed" || !novels.length) return;
    markPostsSeen(novels.map((n) => n.id));
  }, [currentTab, novels]);

  useEffect(() => {
    if (!focusedPostId) return;
    const timeout = setTimeout(() => setFocusedPostId(""), 2200);
    return () => clearTimeout(timeout);
  }, [focusedPostId]);

  // withLoad: runs an async task and optionally increments global pending counter
  // pass options { global: false } to avoid triggering the global fullscreen loader
  const withLoad = async (task, options = { global: true }) => {
    const inc = options?.global !== false;
    if (inc) setPendingCount((v) => v + 1);
    try { return await task(); } finally { if (inc) setPendingCount((v) => Math.max(0, v - 1)); }
  };

  const refreshBase = async () => {
    if (!token) return;
    const [u, n, g] = await withLoad(() => Promise.all([api.users(token), api.notifications(token), api.groups(token)]));
    setUsers(u); setNotifications(n); setGroups(g);
  };

  const refreshNovels = async () => {
    if (!token) return;
    setNovels(await withLoad(() => api.novels(token)));
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u); setError("");
      if (!u) { setToken(""); setProfile(null); setAuthLoading(false); setBootLoading(false); return; }
      setToken(await u.getIdToken()); setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!token) return;
    const boot = async () => {
      setBootLoading(true);
      try {
        const [me, n, nv, g, u] = await withLoad(() => Promise.all([api.me(token), api.notifications(token), api.novels(token), api.groups(token), api.users(token)]));
        setProfile(me); setNotifications(n); setNovels(nv); setGroups(g); setUsers(u);
        setProfileDraft({ nickname: me.nickname || "", bio: me.bio || "" });
        setSetupNickname(me.nickname || ""); setSetupBio(me.bio || "");
        if (g[0]) setSelectedGroup(g[0].id);
      } catch (e) { setError(e.message); }
      finally { setBootLoading(false); }
    };
    boot();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    let inFlight = false;

    const syncFeed = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const latest = await withLoad(() => api.novels(token), { global: false });
        if (mounted) setNovels(latest);
      } catch {
        // keep UI responsive even if periodic sync fails
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(syncFeed, 20000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedGroup || !isGroupChatVisible) return;
    let mounted = true;
    let stopped = false;
    let timer;
    let inFlight = false;
    let isPageHidden = typeof document !== "undefined" ? document.hidden : false;

    const loadMessages = async ({ showLoader = false } = {}) => {
      if (inFlight || !mounted || isPageHidden) return;
      inFlight = true;
      try {
        if (showLoader) setGroupMessagesLoading(true);
        const [members, messages] = await Promise.all([
          api.groupMembers(token, selectedGroup),
          api.groupMessages(token, selectedGroup),
        ]);
        if (!mounted) return;
        setGroupMembers((prev) => {
          const sameSize = prev.length === members.length;
          if (sameSize && prev.every((m, i) => m.uid === members[i]?.uid && m.isAdmin === members[i]?.isAdmin)) return prev;
          return members;
        });
        setGroupMessages((prev) => {
          if (prev.length === messages.length && prev[prev.length - 1]?.id === messages[messages.length - 1]?.id) return prev;
          return messages;
        });
      } catch (e) {
        if (!mounted) return;
        if (String(e.message).includes("Join this group")) {
          setGroupMembers([]);
          setGroupMessages([]);
          return;
        }
        setError(e.message);
      } finally {
        if (mounted && showLoader) setGroupMessagesLoading(false);
        inFlight = false;
      }
    };

    const schedulePoll = () => {
      if (stopped || !mounted) return;
      timer = setTimeout(async () => {
        await loadMessages();
        schedulePoll();
      }, 10000);
    };

    const onVisibility = () => {
      isPageHidden = document.hidden;
      if (!isPageHidden) loadMessages();
    };

    document.addEventListener("visibilitychange", onVisibility);
    loadMessages({ showLoader: true }).finally(schedulePoll);
    return () => {
      mounted = false;
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, selectedGroup, isGroupChatVisible]);

  useEffect(() => {
    if (!token || !dmTargetUid || !isDmChatVisible) return;
    let mounted = true;
    let stopped = false;
    let timer;
    let inFlight = false;
    let isPageHidden = typeof document !== "undefined" ? document.hidden : false;

    const loadDmMessages = async ({ showLoader = false } = {}) => {
      if (inFlight || !mounted || isPageHidden) return;
      inFlight = true;
      try {
        if (showLoader) setDmMessagesLoading(true);
        const messages = await api.dmMessages(token, dmTargetUid);
        if (mounted) {
          setDmMessages((prev) => {
            if (prev.length === messages.length && prev[prev.length - 1]?.id === messages[messages.length - 1]?.id) return prev;
            return messages;
          });
        }
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted && showLoader) setDmMessagesLoading(false);
        inFlight = false;
      }
    };

    const schedulePoll = () => {
      if (stopped || !mounted) return;
      timer = setTimeout(async () => {
        await loadDmMessages();
        schedulePoll();
      }, 10000);
    };

    const onVisibility = () => {
      isPageHidden = document.hidden;
      if (!isPageHidden) loadDmMessages();
    };

    document.addEventListener("visibilitychange", onVisibility);
    loadDmMessages({ showLoader: true }).finally(schedulePoll);
    return () => {
      mounted = false;
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, dmTargetUid, isDmChatVisible]);

  const login = async () => {
    setLoginLoading(true); setError("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      await withLoad(() => signInWithPopup(auth, googleProvider));
    }
    catch (e) { setError(e.message); }
    finally { setLoginLoading(false); }
  };

  const logout = async () => withLoad(() => signOut(auth));

  const saveSetup = async () => {
    try {
      const me = await withLoad(() => api.saveProfile(token, { fullName: setupNickname, nickname: setupNickname, bio: setupBio }));
      setProfile(me); setProfileDraft({ nickname: me.nickname || "", bio: me.bio || "" });
      await refreshBase();
    } catch (e) { setError(e.message); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const me = await withLoad(() => api.saveProfile(token, { fullName: profileDraft.nickname, nickname: profileDraft.nickname, bio: profileDraft.bio }));
      setProfile(me); await refreshBase();
    } catch (x) { setError(x.message); }
  };

  const postNovel = async (e) => {
    e.preventDefault();
    const content = postContent.trim();
    if (content.length < 2) {
      setError("Tweet content must be at least 2 characters");
      return;
    }
    try { await withLoad(() => api.createNovel(token, { content })); setPostContent(""); await refreshNovels(); }
    catch (x) { setError(x.message); }
  };

  const likeNovel = async (id) => {
    try {
      setLikeLoadingId(id);
      // perform like without triggering fullscreen loader; update lists quietly
      await withLoad(() => api.toggleLike(token, id), { global: false });
      const [nv, u] = await Promise.all([
        withLoad(() => api.novels(token), { global: false }),
        withLoad(() => api.users(token), { global: false }),
      ]);
      setNovels(nv);
      setUsers(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setLikeLoadingId("");
    }
  };

  const toggleComments = async (id) => {
    if (commentCache[id]) { setCommentCache((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
    try {
      setCommentLoadingId(id);
      const comments = await withLoad(() => api.comments(token, id), { global: false });
      setCommentCache((p) => ({ ...p, [id]: comments }));
    }
    catch (e) { setError(e.message); }
    finally { setCommentLoadingId(""); }
  };

  const sendComment = async (e, id) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") || "").trim();
    if (!text) return;
    try {
      setCommentLoadingId(id);
      await withLoad(() => api.addComment(token, id, text), { global: false });
      const comments = await withLoad(() => api.comments(token, id), { global: false });
      setCommentCache((p) => ({ ...p, [id]: comments }));
      // update novel's commentsCount locally without hitting global loader
      setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, commentsCount: (n.commentsCount || 0) + 1 } : n)));
      e.currentTarget.reset();
    } catch (x) { setError(x.message); }
    finally { setCommentLoadingId(""); }
  };

  const startEdit = (n) => { setEditingId(n.id); setEditContent(n.content); };
  const saveEdit = async (e, id) => {
    e.preventDefault();
    const content = editContent.trim();
    if (content.length < 2) {
      setError("Tweet content must be at least 2 characters");
      return;
    }
    try { await withLoad(() => api.updateNovel(token, id, { content })); setEditingId(""); await refreshNovels(); } catch (x) { setError(x.message); }
  };
  const delNovel = async (id) => { try { await withLoad(() => api.deleteNovel(token, id)); await refreshNovels(); } catch (x) { setError(x.message); } };

  const createGroup = async (e) => { e.preventDefault(); try { const g = await withLoad(() => api.createGroup(token, { name: groupName, description: groupDesc })); setGroupName(""); setGroupDesc(""); setSelectedGroup(g.id); setMobileGroupPage("chat"); await refreshBase(); } catch (x) { setError(x.message); } };

  const joinOrLeave = async (g) => {
    try {
      if (g.joined) {
        const result = await withLoad(() => api.leaveGroup(token, g.id, false));
        if (result?.requiresConfirmDelete) { setPendingLeaveGroupId(g.id); return; }
      } else await withLoad(() => api.joinGroup(token, g.id));
      await refreshBase();
    } catch (x) {
      if (x?.payload?.requiresConfirmDelete) {
        setPendingLeaveGroupId(g.id);
        setError("");
        return;
      }
      setError(x.message);
    }
  };

  const confirmLeaveDelete = async () => {
    if (!pendingLeaveGroupId) return;
    try { await withLoad(() => api.leaveGroup(token, pendingLeaveGroupId, true)); setPendingLeaveGroupId(""); setSelectedGroup(""); setMobileGroupPage("list"); await refreshBase(); }
    catch (x) { setError(x.message); }
  };

  const joinByCode = async (e) => { e.preventDefault(); if (!inviteCodeInput.trim()) return; try { await withLoad(() => api.joinByCode(token, inviteCodeInput.trim().split("/").pop())); setInviteCodeInput(""); await refreshBase(); } catch (x) { setError(x.message); } };
  const promote = async (uid) => { try { await withLoad(() => api.promoteAdmin(token, selectedGroup, uid)); setGroupMembers(await withLoad(() => api.groupMembers(token, selectedGroup))); await refreshBase(); } catch (x) { setError(x.message); } };
  const removeMember = async (uid) => { try { await withLoad(() => api.removeMember(token, selectedGroup, uid)); setGroupMembers(await withLoad(() => api.groupMembers(token, selectedGroup))); await refreshBase(); } catch (x) { setError(x.message); } };

  const sendGroup = async (e) => {
    e.preventDefault();
    const text = groupDraft.trim();
    if ((!text && !groupImageData && !groupAudioData) || !selectedGroup || groupSending) return;
    try {
      setGroupSending(true);
      const created = await api.sendGroupMessage(token, selectedGroup, {
        text,
        imageData: groupImageData,
        audioData: groupAudioData,
        replyToMessageId: groupReplyTo?.id || "",
      });
      setGroupMessages((prev) => [...prev, created]);
      setGroupDraft("");
      setGroupImageData("");
      setGroupAudioData("");
      setGroupReplyTo(null);
    }
    catch (x) { setError(x.message); }
    finally { setGroupSending(false); }
  };

  const sendDm = async (e) => {
    e.preventDefault();
    const text = dmDraft.trim();
    if ((!text && !dmImageData && !dmAudioData) || !dmTargetUid || dmSending) return;
    try {
      setDmSending(true);
      const created = await api.sendDm(token, dmTargetUid, {
        text,
        imageData: dmImageData,
        audioData: dmAudioData,
        replyToMessageId: dmReplyTo?.id || "",
      });
      setDmMessages((prev) => [...prev, created]);
      setDmDraft("");
      setDmImageData("");
      setDmAudioData("");
      setDmReplyTo(null);
    }
    catch (x) { setError(x.message); }
    finally { setDmSending(false); }
  };

  const markRead = async (id) => { try { await withLoad(() => api.markNotificationRead(token, id), { global: false }); setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))); } catch (x) { setError(x.message); } };
  const clearNotifications = async () => {
    try {
      await withLoad(() => api.clearNotifications(token), { global: false });
      setNotifications([]);
    } catch (x) {
      setError(x.message);
    }
  };

  const openNotification = async (notification) => {
    if (!notification) return;
    if (!notification.read) await markRead(notification.id);

    if ((notification.type === "novel_like" || notification.type === "novel_comment") && notification.novelId) {
      const exists = novels.some((n) => n.id === notification.novelId);
      setFocusedPostId(notification.novelId);
      navigate("/feed");
      if (!exists) setError("This post is no longer available.");
      return;
    }
    if (notification.type === "group_reply" && notification.groupId) {
      const group = groups.find((g) => g.id === notification.groupId);
      if (!group) {
        navigate("/groups");
        setError("This group is no longer available.");
        return;
      }
      setSelectedGroup(notification.groupId);
      setMobileGroupPage("chat");
      navigate("/groups");
      if (!group.joined) setError("You are no longer a member of this group.");
      return;
    }
    if (notification.type === "dm_reply" && notification.actorUid) {
      const exists = users.some((u) => u.uid === notification.actorUid);
      if (!exists) {
        navigate("/dm");
        setError("This user is no longer available.");
        return;
      }
      setDmTargetUid(notification.actorUid);
      setMobileDmPage("chat");
      navigate("/dm");
      return;
    }
    navigate("/notifications");
  };

  if (checking) return <div className="center-screen loading-screen"><div className="spinner" /></div>;
  if (!firebaseUser) return <AuthLanding login={login} loginLoading={loginLoading} error={error} />;
  if (!profile?.fullName || !profile?.nickname) return <SetupProfile firebaseUser={firebaseUser} setupNickname={setupNickname} setSetupNickname={setSetupNickname} setupBio={setupBio} setSetupBio={setSetupBio} saveSetup={saveSetup} error={error} />;

  return (
    <div className="app-shell">
      <TopNav tabs={TABS} tab={currentTab} setTab={(nextTab) => navigate(`/${nextTab}`)} profile={profile} firebaseUser={firebaseUser} onLogout={logout} badgeCounts={badgeCounts} />

      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedView novels={novels} users={users} editingId={editingId} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit} setEditingId={setEditingId} timeAgo={timeAgo} containsArabic={containsArabic} likeNovel={likeNovel} likeLoadingId={likeLoadingId} commentLoadingId={commentLoadingId} toggleComments={toggleComments} profile={profile} startEdit={startEdit} delNovel={delNovel} commentCache={commentCache} sendComment={sendComment} onOpenPublish={() => setShowPublishModal(true)} focusedPostId={focusedPostId} />} />
        <Route path="/groups" element={<GroupsView isMobile={isMobile} mobileGroupPage={mobileGroupPage} setMobileGroupPage={setMobileGroupPage} showGroupMembers={showGroupMembers} setShowGroupMembers={setShowGroupMembers} groupMessagesLoading={groupMessagesLoading} createGroup={createGroup} groupName={groupName} setGroupName={setGroupName} groupDesc={groupDesc} setGroupDesc={setGroupDesc} joinByCode={joinByCode} inviteCodeInput={inviteCodeInput} setInviteCodeInput={setInviteCodeInput} groups={groups} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} joinOrLeave={joinOrLeave} selectedGroupData={selectedGroupData} groupMessages={groupMessages} profile={profile} timeAgo={timeAgo} setGroupReplyTo={setGroupReplyTo} groupReplyTo={groupReplyTo} groupDraft={groupDraft} setGroupDraft={setGroupDraft} sendGroup={sendGroup} groupSending={groupSending} groupImageData={groupImageData} setGroupImageData={setGroupImageData} groupAudioData={groupAudioData} setGroupAudioData={setGroupAudioData} groupMembers={groupMembers} promote={promote} removeMember={removeMember} />} />
        <Route path="/dm" element={<DmView isMobile={isMobile} mobileDmPage={mobileDmPage} setMobileDmPage={setMobileDmPage} dmMessagesLoading={dmMessagesLoading} others={others} dmTargetUid={dmTargetUid} setDmTargetUid={setDmTargetUid} setDmReplyTo={setDmReplyTo} dmMessages={dmMessages} profile={profile} timeAgo={timeAgo} dmReplyTo={dmReplyTo} dmDraft={dmDraft} setDmDraft={setDmDraft} sendDm={sendDm} dmSending={dmSending} dmImageData={dmImageData} setDmImageData={setDmImageData} dmAudioData={dmAudioData} setDmAudioData={setDmAudioData} />} />
        <Route path="/notifications" element={<NotificationsView notifications={notifications} notifText={notifText} timeAgo={timeAgo} openNotification={openNotification} clearNotifications={clearNotifications} />} />
        <Route path="/profile" element={<ProfileView profile={profile} firebaseUser={firebaseUser} profileDraft={profileDraft} setProfileDraft={setProfileDraft} saveProfile={saveProfile} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <PublishNovelModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        postContent={postContent}
        setPostContent={setPostContent}
        postNovel={(e) => {
          postNovel(e);
          setShowPublishModal(false);
        }}
      />

      {pendingLeaveGroupId && <ConfirmLeaveModal onConfirm={confirmLeaveDelete} onCancel={() => setPendingLeaveGroupId("")} />}
      {busy && !pendingLeaveGroupId && <div className="loading-overlay" role="status" aria-live="polite"><div className="spinner" /></div>}
    </div>
  );
}

export default App;
