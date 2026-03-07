import { useEffect, useMemo, useState } from "react";
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
import NotFoundPage from "./components/NotFoundPage";

const TABS = ["feed", "groups", "dm", "notifications", "profile"];
const LANGS = ["English", "Arabic", "French", "Spanish", "German", "Portuguese", "Italian", "Turkish", "Hindi", "Urdu", "Japanese", "Korean", "Chinese", "Russian"];

const timeAgo = (v) => {
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
  if (Number.isNaN(s) || s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 604800)}w`;
};

const containsArabic = (t) => /[\u0600-\u06FF]/.test(t || "");
const notifText = (n) => {
  if (n.type === "novel_like") return `${n.actorNickname || "Someone"} liked your novel`;
  if (n.type === "novel_comment") return `${n.actorNickname || "Someone"} commented on your novel`;
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

  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [setupNickname, setSetupNickname] = useState("");
  const [setupBio, setSetupBio] = useState("");
  const [profileDraft, setProfileDraft] = useState({ nickname: "", bio: "" });

  const [novels, setNovels] = useState([]);
  const [commentCache, setCommentCache] = useState({});
  const [postTitle, setPostTitle] = useState("");
  const [postLanguage, setPostLanguage] = useState("English");
  const [postContent, setPostContent] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLang, setEditLang] = useState("English");
  const [editContent, setEditContent] = useState("");

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [groupReplyTo, setGroupReplyTo] = useState(null);
  const [groupSending, setGroupSending] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [pendingLeaveGroupId, setPendingLeaveGroupId] = useState("");
  const [mobileGroupPage, setMobileGroupPage] = useState("list");

  const [dmTargetUid, setDmTargetUid] = useState("");
  const [dmMessages, setDmMessages] = useState([]);
  const [dmDraft, setDmDraft] = useState("");
  const [dmReplyTo, setDmReplyTo] = useState(null);
  const [dmSending, setDmSending] = useState(false);

  const currentTab = useMemo(() => {
    const firstSegment = location.pathname.split("/")[1];
    return TABS.includes(firstSegment) ? firstSegment : "feed";
  }, [location.pathname]);

  const busy = pendingCount > 0;
  const checking = authLoading || (Boolean(firebaseUser) && bootLoading);
  const selectedGroupData = useMemo(() => groups.find((g) => g.id === selectedGroup), [groups, selectedGroup]);
  const others = useMemo(() => users.filter((u) => u.uid !== profile?.uid && u.nickname), [users, profile]);

  const withLoad = async (task) => {
    setPendingCount((v) => v + 1);
    try { return await task(); } finally { setPendingCount((v) => Math.max(0, v - 1)); }
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
    if (!token || !selectedGroup) return;
    let mounted = true;
    const tick = async () => {
      try {
        const [members, messages] = await Promise.all([api.groupMembers(token, selectedGroup), api.groupMessages(token, selectedGroup)]);
        if (!mounted) return;
        setGroupMembers(members); setGroupMessages(messages);
      } catch (e) {
        if (!mounted) return;
        if (String(e.message).includes("Join this group")) {
          setGroupMembers([]);
          setGroupMessages([]);
          return;
        }
        setError(e.message);
      }
    };
    tick();
    const timer = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [token, selectedGroup]);

  useEffect(() => {
    if (!token || !dmTargetUid) return;
    let mounted = true;
    const tick = async () => { try { const messages = await api.dmMessages(token, dmTargetUid); if (mounted) setDmMessages(messages); } catch (e) { if (mounted) setError(e.message); } };
    tick();
    const timer = setInterval(tick, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [token, dmTargetUid]);

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
    try { await withLoad(() => api.createNovel(token, { title: postTitle, language: postLanguage, content: postContent })); setPostTitle(""); setPostLanguage("English"); setPostContent(""); await refreshNovels(); }
    catch (x) { setError(x.message); }
  };

  const likeNovel = async (id) => { try { await withLoad(() => api.toggleLike(token, id)); await refreshNovels(); await refreshBase(); } catch (e) { setError(e.message); } };

  const toggleComments = async (id) => {
    if (commentCache[id]) { setCommentCache((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
    try { const comments = await withLoad(() => api.comments(token, id)); setCommentCache((p) => ({ ...p, [id]: comments })); }
    catch (e) { setError(e.message); }
  };

  const sendComment = async (e, id) => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") || "").trim();
    if (!text) return;
    try {
      await withLoad(() => api.addComment(token, id, text));
      const comments = await withLoad(() => api.comments(token, id));
      setCommentCache((p) => ({ ...p, [id]: comments }));
      await refreshNovels(); await refreshBase(); e.currentTarget.reset();
    } catch (x) { setError(x.message); }
  };

  const startEdit = (n) => { setEditingId(n.id); setEditTitle(n.title); setEditLang(n.language); setEditContent(n.content); };
  const saveEdit = async (e, id) => { e.preventDefault(); try { await withLoad(() => api.updateNovel(token, id, { title: editTitle, language: editLang, content: editContent })); setEditingId(""); await refreshNovels(); } catch (x) { setError(x.message); } };
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
    if (!groupDraft.trim() || !selectedGroup || groupSending) return;
    try {
      setGroupSending(true);
      const created = await api.sendGroupMessage(token, selectedGroup, {
        text: groupDraft,
        replyToMessageId: groupReplyTo?.id || "",
      });
      setGroupMessages((prev) => [...prev, created]);
      setGroupDraft("");
      setGroupReplyTo(null);
    }
    catch (x) { setError(x.message); }
    finally { setGroupSending(false); }
  };

  const sendDm = async (e) => {
    e.preventDefault();
    if (!dmDraft.trim() || !dmTargetUid || dmSending) return;
    try {
      setDmSending(true);
      const created = await api.sendDm(token, dmTargetUid, {
        text: dmDraft,
        replyToMessageId: dmReplyTo?.id || "",
      });
      setDmMessages((prev) => [...prev, created]);
      setDmDraft("");
      setDmReplyTo(null);
    }
    catch (x) { setError(x.message); }
    finally { setDmSending(false); }
  };

  const markRead = async (id) => { try { await withLoad(() => api.markNotificationRead(token, id)); setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))); } catch (x) { setError(x.message); } };

  if (checking) return <div className="center-screen loading-screen"><div className="spinner" /></div>;
  if (!firebaseUser) return <AuthLanding login={login} loginLoading={loginLoading} error={error} />;
  if (!profile?.fullName || !profile?.nickname) return <SetupProfile firebaseUser={firebaseUser} setupNickname={setupNickname} setSetupNickname={setSetupNickname} setupBio={setupBio} setSetupBio={setSetupBio} saveSetup={saveSetup} error={error} />;

  return (
    <div className="app-shell">
      <TopNav tabs={TABS} tab={currentTab} setTab={(nextTab) => navigate(`/${nextTab}`)} profile={profile} firebaseUser={firebaseUser} onLogout={logout} />
      {error && <p className="error-banner">{error}</p>}

      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedView LANGS={LANGS} postTitle={postTitle} setPostTitle={setPostTitle} postLanguage={postLanguage} setPostLanguage={setPostLanguage} postContent={postContent} setPostContent={setPostContent} postNovel={postNovel} novels={novels} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} editLang={editLang} setEditLang={setEditLang} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit} setEditingId={setEditingId} timeAgo={timeAgo} containsArabic={containsArabic} likeNovel={likeNovel} toggleComments={toggleComments} profile={profile} startEdit={startEdit} delNovel={delNovel} commentCache={commentCache} sendComment={sendComment} />} />
        <Route path="/groups" element={<GroupsView isMobile={isMobile} mobileGroupPage={mobileGroupPage} setMobileGroupPage={setMobileGroupPage} createGroup={createGroup} groupName={groupName} setGroupName={setGroupName} groupDesc={groupDesc} setGroupDesc={setGroupDesc} joinByCode={joinByCode} inviteCodeInput={inviteCodeInput} setInviteCodeInput={setInviteCodeInput} groups={groups} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} joinOrLeave={joinOrLeave} selectedGroupData={selectedGroupData} groupMessages={groupMessages} profile={profile} timeAgo={timeAgo} setGroupReplyTo={setGroupReplyTo} groupReplyTo={groupReplyTo} groupDraft={groupDraft} setGroupDraft={setGroupDraft} sendGroup={sendGroup} groupSending={groupSending} groupMembers={groupMembers} promote={promote} removeMember={removeMember} />} />
        <Route path="/dm" element={<DmView others={others} dmTargetUid={dmTargetUid} setDmTargetUid={setDmTargetUid} setDmReplyTo={setDmReplyTo} dmMessages={dmMessages} profile={profile} timeAgo={timeAgo} dmReplyTo={dmReplyTo} dmDraft={dmDraft} setDmDraft={setDmDraft} sendDm={sendDm} dmSending={dmSending} />} />
        <Route path="/notifications" element={<NotificationsView notifications={notifications} notifText={notifText} timeAgo={timeAgo} markRead={markRead} />} />
        <Route path="/profile" element={<ProfileView profile={profile} firebaseUser={firebaseUser} profileDraft={profileDraft} setProfileDraft={setProfileDraft} saveProfile={saveProfile} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {pendingLeaveGroupId && <ConfirmLeaveModal onConfirm={confirmLeaveDelete} onCancel={() => setPendingLeaveGroupId("")} />}
      {busy && !pendingLeaveGroupId && <div className="loading-overlay" role="status" aria-live="polite"><div className="spinner" /></div>}
    </div>
  );
}

export default App;
