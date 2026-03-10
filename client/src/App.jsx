import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { auth, googleProvider } from "./firebase";
import { API_BASE_URL, api } from "./api";
import "./App.css";
const TopNav = lazy(() => import("./components/TopNav"));
const AuthLanding = lazy(() => import("./components/AuthLanding"));
const SetupProfile = lazy(() => import("./components/SetupProfile"));
const FeedView = lazy(() => import("./components/FeedView"));
const GroupsView = lazy(() => import("./components/GroupsView"));
const DmView = lazy(() => import("./components/DmView"));
const NotificationsView = lazy(() => import("./components/NotificationsView"));
const ProfileView = lazy(() => import("./components/ProfileView"));
const UserProfileView = lazy(() => import("./components/UserProfileView"));
const ConfirmLeaveModal = lazy(() => import("./components/ConfirmLeaveModal"));
const PublishTweetModal = lazy(() => import("./components/PublishTweetModal"));
const PostCommentsModal = lazy(() => import("./components/PostCommentsModal"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

const TABS = ["feed", "groups", "dm", "notifications", "profile"];
export const INTEREST_OPTIONS = [
  "technology",
  "gaming",
  "sports",
  "movies",
  "music",
  "business",
  "finance",
  "politics",
  "science",
  "fitness",
  "design",
  "education",
  "travel",
  "food",
];

const containsArabic = (t) => /[\u0600-\u06FF]/.test(t || "");
const notifText = (n) => {
  if (n.type === "tweet_like") return `${n.actorNickname || "Someone"} liked your tweet`;
  if (n.type === "tweet_comment") return `${n.actorNickname || "Someone"} replied to your tweet`;
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
  const [bootHydrated, setBootHydrated] = useState(false);
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
  const [setupInterests, setSetupInterests] = useState([]);
  const [profileDraft, setProfileDraft] = useState({ nickname: "", bio: "", photoURL: "", interests: [] });

  const [tweets, setTweets] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [commentCache, setCommentCache] = useState({});
  const [commentsModalTweetId, setCommentsModalTweetId] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postImageData, setPostImageData] = useState("");
  const [postAudioData, setPostAudioData] = useState("");
  const [postVideoData, setPostVideoData] = useState("");
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
  const [groupVideoData, setGroupVideoData] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [pendingLeaveGroupId, setPendingLeaveGroupId] = useState("");
  const [mobileGroupPage, setMobileGroupPage] = useState("list");
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMessagesLoading, setGroupMessagesLoading] = useState(false);
  const [focusedGroupMessageId, setFocusedGroupMessageId] = useState("");
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);

  const [dmTargetUid, setDmTargetUid] = useState("");
  const [dmMessages, setDmMessages] = useState([]);
  const [dmDraft, setDmDraft] = useState("");
  const [dmReplyTo, setDmReplyTo] = useState(null);
  const [dmSending, setDmSending] = useState(false);
  const [dmImageData, setDmImageData] = useState("");
  const [dmAudioData, setDmAudioData] = useState("");
  const [dmVideoData, setDmVideoData] = useState("");
  const [mobileDmPage, setMobileDmPage] = useState("list");
  const [dmMessagesLoading, setDmMessagesLoading] = useState(false);
  const [focusedDmMessageId, setFocusedDmMessageId] = useState("");
  const [likeLoadingId, setLikeLoadingId] = useState("");
  const [commentLoadingId, setCommentLoadingId] = useState("");
  const [commentLikeLoadingId, setCommentLikeLoadingId] = useState("");
  const [soundSettings, setSoundSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("mega_tweets_sound_settings");
      if (!raw) return { notifications: true, dm: true, groups: true };
      const parsed = JSON.parse(raw);
      return {
        notifications: parsed?.notifications !== false,
        dm: parsed?.dm !== false,
        groups: parsed?.groups !== false,
      };
    } catch {
      return { notifications: true, dm: true, groups: true };
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("mega_tweets_theme");
      return saved === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const audioContextRef = useRef(null);
  const notificationsInitRef = useRef(false);
  const previousUnreadRef = useRef(0);
  const dmBaselineRef = useRef({ uid: "", lastId: "" });
  const groupBaselineRef = useRef({ groupId: "", lastId: "" });

  const currentTab = useMemo(() => {
    const firstSegment = location.pathname.split("/")[1];
    return TABS.includes(firstSegment) ? firstSegment : "";
  }, [location.pathname]);

  const busy = pendingCount > 0;
  const checking = authLoading || (Boolean(firebaseUser) && !bootHydrated);
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
  const activeCommentsTweet = useMemo(
    () => tweets.find((tweet) => tweet.id === commentsModalTweetId) || null,
    [tweets, commentsModalTweetId],
  );
  const others = useMemo(() => {
    const list = users.filter((u) => u.uid !== profile?.uid && u.nickname);
    return [...list].sort((a, b) => {
      const aFollow = Boolean(a.isFollowing);
      const bFollow = Boolean(b.isFollowing);
      if (aFollow !== bFollow) return aFollow ? -1 : 1;
      return (a.nickname || "").localeCompare(b.nickname || "");
    });
  }, [users, profile]);
  const isGroupChatVisible = currentTab === "groups" && (!isMobile || mobileGroupPage === "chat");
  const isDmChatVisible = currentTab === "dm" && (!isMobile || mobileDmPage === "chat");
  const unreadNotificationsCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read), [notifications]);
  const unseenFeedCount = useMemo(() => tweets.filter((n) => !seenPostIds[n.id]).length, [tweets, seenPostIds]);
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

  useEffect(() => {
    localStorage.setItem("mega_tweets_sound_settings", JSON.stringify(soundSettings));
  }, [soundSettings]);

  useEffect(() => {
    const nextTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem("mega_tweets_theme", nextTheme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const withResolvedPhoto = (entity, fallbackPhotoURL = "") => {
    if (!entity) return entity;
    return {
      ...entity,
      photoURL: entity.photoURL || entity.photoUrl || fallbackPhotoURL || "",
    };
  };

  const syncMissingProfilePhoto = async (candidate) => {
    if (!token || !candidate?.nickname || !(candidate?.interests || []).length || candidate.photoURL) return candidate;
    const fallbackPhotoURL = firebaseUser?.photoURL || "";
    if (!fallbackPhotoURL) return candidate;
    try {
      return await api.saveProfile(token, {
        fullName: candidate.fullName || candidate.nickname,
        nickname: candidate.nickname,
        bio: candidate.bio || "",
        photoURL: fallbackPhotoURL,
        interests: candidate.interests || [],
      });
    } catch {
      return withResolvedPhoto(candidate, fallbackPhotoURL);
    }
  };

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

  const playSound = useCallback((type) => {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const pulse = (start, freq, duration, gain = 0.035) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    if (type === "notification") {
      pulse(now, 920, 0.11, 0.03);
      pulse(now + 0.12, 1160, 0.12, 0.03);
    } else if (type === "dm") {
      pulse(now, 760, 0.1, 0.03);
      pulse(now + 0.1, 980, 0.1, 0.03);
    } else if (type === "group") {
      pulse(now, 620, 0.1, 0.03);
      pulse(now + 0.12, 780, 0.1, 0.03);
    }
  }, []);

  useEffect(() => {
    if (currentTab !== "feed" || !tweets.length) return;
    markPostsSeen(tweets.map((n) => n.id));
  }, [currentTab, tweets]);

  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    if (!notificationsInitRef.current) {
      notificationsInitRef.current = true;
      previousUnreadRef.current = unread;
      return;
    }
    if (unread > previousUnreadRef.current && soundSettings.notifications) {
      playSound("notification");
    }
    previousUnreadRef.current = unread;
  }, [notifications, soundSettings.notifications, playSound]);

  useEffect(() => {
    const latest = dmMessages[dmMessages.length - 1];
    if (!dmTargetUid || !latest) {
      dmBaselineRef.current = { uid: dmTargetUid || "", lastId: latest?.id || "" };
      return;
    }
    if (dmBaselineRef.current.uid !== dmTargetUid) {
      dmBaselineRef.current = { uid: dmTargetUid, lastId: latest.id };
      return;
    }
    if (latest.id !== dmBaselineRef.current.lastId) {
      if (latest.senderUid !== profile?.uid && soundSettings.dm) playSound("dm");
      dmBaselineRef.current.lastId = latest.id;
    }
  }, [dmMessages, dmTargetUid, profile?.uid, soundSettings.dm, playSound]);

  useEffect(() => {
    const latest = groupMessages[groupMessages.length - 1];
    if (!selectedGroup || !latest) {
      groupBaselineRef.current = { groupId: selectedGroup || "", lastId: latest?.id || "" };
      return;
    }
    if (groupBaselineRef.current.groupId !== selectedGroup) {
      groupBaselineRef.current = { groupId: selectedGroup, lastId: latest.id };
      return;
    }
    if (latest.id !== groupBaselineRef.current.lastId) {
      if (latest.senderUid !== profile?.uid && soundSettings.groups) playSound("group");
      groupBaselineRef.current.lastId = latest.id;
    }
  }, [groupMessages, selectedGroup, profile?.uid, soundSettings.groups, playSound]);

  useEffect(() => {
    if (!focusedPostId) return;
    const timeout = setTimeout(() => setFocusedPostId(""), 1000);
    return () => clearTimeout(timeout);
  }, [focusedPostId]);

  useEffect(() => {
    if (!focusedGroupMessageId) return;
    const timeout = setTimeout(() => setFocusedGroupMessageId(""), 1000);
    return () => clearTimeout(timeout);
  }, [focusedGroupMessageId]);

  useEffect(() => {
    if (!focusedDmMessageId) return;
    const timeout = setTimeout(() => setFocusedDmMessageId(""), 1000);
    return () => clearTimeout(timeout);
  }, [focusedDmMessageId]);

  // withLoad: runs an async task and optionally increments global pending counter
  // pass options { global: false } to avoid triggering the global fullscreen loader
  const withLoad = async (task, options = { global: true }) => {
    const inc = options?.global !== false;
    if (inc) setPendingCount((v) => v + 1);
    try { return await task(); } finally { if (inc) setPendingCount((v) => Math.max(0, v - 1)); }
  };

  const refreshBase = async () => {
    if (!token) return;
    const [u, n, g] = await withLoad(
      () => Promise.all([api.users(token), api.notifications(token), api.groups(token)]),
      { global: false },
    );
    setUsers(u); setNotifications(n); setGroups(g);
  };

  const refreshTweets = async (options = {}) => {
    if (!token) return;
    setFeedLoading(true);
    try {
      const data = await withLoad(() => api.tweets(token, options), { global: false });
      setTweets(data);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cacheKey = (uid) => `mega_tweets_boot_${uid}`;
  const readCache = (uid) => {
    if (!uid) return null;
    try {
      const raw = localStorage.getItem(cacheKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const writeCache = (uid, data) => {
    if (!uid) return;
    try {
      localStorage.setItem(cacheKey(uid), JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setError("");
      setBootHydrated(false);
      if (!u) {
        setToken("");
        setProfile(null);
        setUsers([]);
        setGroups([]);
        setTweets([]);
        setNotifications([]);
        setAuthLoading(false);
        setBootLoading(false);
        return;
      }
      try {
        // Use cached token for faster boot; refresh on 401 later.
        const cachedToken = await u.getIdToken(false);
        setToken(cachedToken);
      } catch (e2) {
        console.error("Failed to get any ID token:", e2?.code || e2?.message);
        setError("Authentication failed. Please sign out and sign in again.");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!token) return;
    const boot = async () => {
      setBootLoading(true);
      try {
        const cached = readCache(auth.currentUser?.uid);
        if (cached?.profile) {
          const cachedProfile = cached.profile;
          setProfile(cachedProfile);
          setUsers(cached.users || []);
          setTweets(cached.tweets || []);
          setGroups(cached.groups || []);
          setNotifications(cached.notifications || []);
          setProfileDraft({
            nickname: cachedProfile.nickname || "",
            bio: cachedProfile.bio || "",
            photoURL: cachedProfile.photoURL || "",
            interests: cachedProfile.interests || [],
          });
          setSetupNickname(cachedProfile.nickname || "");
          setSetupBio(cachedProfile.bio || "");
          setSetupInterests(cachedProfile.interests || []);
          if ((cached.groups || [])[0] && !selectedGroup) setSelectedGroup(cached.groups[0].id);
          setBootHydrated(true);
        }

        const me = await withLoad(() => api.me(token), { global: false });
        const hydratedMe = await syncMissingProfilePhoto(withResolvedPhoto(me, firebaseUser?.photoURL || ""));
        setProfile(hydratedMe);
        setProfileDraft({
          nickname: hydratedMe.nickname || "",
          bio: hydratedMe.bio || "",
          photoURL: hydratedMe.photoURL || "",
          interests: hydratedMe.interests || [],
        });
        setSetupNickname(hydratedMe.nickname || "");
        setSetupBio(hydratedMe.bio || "");
        setSetupInterests(hydratedMe.interests || []);

        // Fast path: load tweets first, then hydrate the rest in the background.
        await refreshTweets({ limit: 30 });
        setBootHydrated(true);

        refreshBase().catch(() => {});

        writeCache(auth.currentUser?.uid, {
          profile: hydratedMe,
          notifications,
          tweets,
          groups,
          users,
        });
      } catch (e) {
        // If 401, try refreshing the token once and retry boot
        if (e?.status === 401 && auth.currentUser) {
          try {
            const freshToken = await auth.currentUser.getIdToken(true);
            setToken(freshToken);
            return; // token update will re-trigger this effect
          } catch { /* fall through to error handling below */ }
        }
        console.error("Boot failed", {
          message: e?.message,
          url: e?.url,
          path: e?.path,
          apiBaseUrl: API_BASE_URL,
          cause: e?.cause?.message || "",
        });
        setError(e?.url ? `${e.message}\n${e.url}` : e.message);
      }
      finally {
        setBootLoading(false);
        setBootHydrated(true);
      }
    };
    boot();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    let stopped = false;
    let timer;
    let isPageHidden = typeof document !== "undefined" ? document.hidden : false;

    const syncGroupsAndNotifications = async () => {
      if (!mounted || isPageHidden) return;
      try {
        const [nextNotifications, nextGroups] = await Promise.all([
          api.notifications(token),
          api.groups(token),
        ]);
        if (!mounted) return;
        setNotifications(nextNotifications);
        setGroups(nextGroups);
      } catch {
        // keep silent on background sync errors
      }
    };

    const schedule = () => {
      if (stopped || !mounted) return;
      timer = setTimeout(async () => {
        await syncGroupsAndNotifications();
        schedule();
      }, 15000);
    };

    const onVisibility = () => {
      isPageHidden = document.hidden;
      if (!isPageHidden) syncGroupsAndNotifications();
    };

    document.addEventListener("visibilitychange", onVisibility);
    syncGroupsAndNotifications().finally(schedule);
    return () => {
      mounted = false;
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

  const activeView = useMemo(() => {
    if (isGroupChatVisible && selectedGroup) return { type: "group", groupId: selectedGroup, otherUid: "" };
    if (isDmChatVisible && dmTargetUid) return { type: "dm", groupId: "", otherUid: dmTargetUid };
    return { type: "none", groupId: "", otherUid: "" };
  }, [isGroupChatVisible, selectedGroup, isDmChatVisible, dmTargetUid]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    let timer;
    const pingPresence = async () => {
      try {
        await api.presenceView(token, activeView);
      } catch {
        // presence ping failures should not block UI
      }
    };
    pingPresence();
    timer = setInterval(() => {
      if (mounted) pingPresence();
    }, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [token, activeView]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    let inFlight = false;

    const syncFeed = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const latest = await withLoad(() => api.tweets(token), { global: false });
        if (mounted) setTweets(latest);
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
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("FirebaseAuthentication")) {
        await withLoad(async () => {
          const result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
          const idToken = result?.credential?.idToken
            || result?.credential?.accessToken
            || result?.idToken
            || "";
          if (!idToken) throw new Error("Google login failed: missing token");
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        });
      } else {
        await withLoad(() => signInWithPopup(auth, googleProvider));
      }
    }
    catch (e) { setError(e.message); }
    finally { setLoginLoading(false); }
  };

  const logout = async () => withLoad(async () => {
    if (Capacitor.isNativePlatform()) {
      try { await FirebaseAuthentication.signOut(); } catch {}
    }
    await signOut(auth);
  });

  const saveSetup = async () => {
    try {
      const me = await withLoad(() => api.saveProfile(token, {
        fullName: setupNickname,
        nickname: setupNickname,
        bio: setupBio,
        photoURL: firebaseUser?.photoURL || "",
        interests: setupInterests,
      }));
      const hydratedMe = withResolvedPhoto(me, firebaseUser?.photoURL || "");
      setProfile(hydratedMe);
      setProfileDraft({
        nickname: hydratedMe.nickname || "",
        bio: hydratedMe.bio || "",
        photoURL: hydratedMe.photoURL || "",
        interests: hydratedMe.interests || [],
      });
      await refreshBase();
    } catch (e) { setError(e.message); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const me = await withLoad(() => api.saveProfile(token, {
        fullName: profileDraft.nickname,
        nickname: profileDraft.nickname,
        bio: profileDraft.bio,
        photoURL: profileDraft.photoURL || firebaseUser?.photoURL || "",
        interests: profileDraft.interests || [],
      }));
      setProfile(withResolvedPhoto(me, firebaseUser?.photoURL || "")); await refreshBase();
    } catch (x) { setError(x.message); }
  };

  const toggleFollowUser = async (targetUid) => {
    if (!targetUid || targetUid === profile?.uid) return;
    try {
      const result = await withLoad(() => api.toggleFollow(token, targetUid), { global: false });
      setUsers((prev) => prev.map((user) => (
        user.uid === targetUid
          ? {
            ...user,
            isFollowing: result.following,
            followerCount: Math.max(0, (user.followerCount || 0) + (result.following ? 1 : -1)),
          }
          : user
      )));
      setProfile((prev) => {
        if (!prev) return prev;
        const nextIds = new Set(prev.followingIds || []);
        if (result.following) nextIds.add(targetUid);
        else nextIds.delete(targetUid);
        return {
          ...prev,
          followingIds: [...nextIds],
          followingCount: nextIds.size,
        };
      });
    } catch (x) { setError(x.message); }
  };

  const postTweet = async (e) => {
    e.preventDefault();
    const content = postContent.trim();
    if (content.length < 2 && !postImageData && !postAudioData && !postVideoData) {
      setError("Tweet content must be at least 2 characters or include media");
      return;
    }
    try {
      await withLoad(() => api.createTweet(token, {
        content,
        imageData: postImageData,
        audioData: postAudioData,
        videoData: postVideoData,
      }));
      setPostContent("");
      setPostImageData("");
      setPostAudioData("");
      setPostVideoData("");
      await refreshTweets();
    }
    catch (x) { setError(x.message); }
  };

  const likeTweet = async (id) => {
    if (!id || likeLoadingId === id) return;
    const current = tweets.find((tweet) => tweet.id === id);
    if (!current) return;
    const optimisticLiked = !current.likedByMe;
    const optimisticCount = Math.max(0, (current.likesCount || 0) + (optimisticLiked ? 1 : -1));
    setTweets((prev) => prev.map((tweet) => (
      tweet.id === id ? { ...tweet, likedByMe: optimisticLiked, likesCount: optimisticCount } : tweet
    )));
    try {
      setLikeLoadingId(id);
      const result = await withLoad(() => api.toggleLike(token, id), { global: false });
      setTweets((prev) => prev.map((tweet) => (
        tweet.id === id ? { ...tweet, likedByMe: result.liked, likesCount: result.likesCount } : tweet
      )));
    } catch (e) {
      setTweets((prev) => prev.map((tweet) => (tweet.id === id ? current : tweet)));
      setError(e.message);
    } finally {
      setLikeLoadingId("");
    }
  };

  const openCommentsModal = async (tweetId) => {
    if (!tweetId) return;
    setCommentsModalTweetId(tweetId);
    try {
      setCommentLoadingId(tweetId);
      const comments = await withLoad(() => api.comments(token, tweetId), { global: false });
      setCommentCache((prev) => ({ ...prev, [tweetId]: comments }));
    }
    catch (e) { setError(e.message); }
    finally { setCommentLoadingId(""); }
  };

  const sendComment = async (tweetId, text, parentCommentId = "") => {
    if (!text) return;
    try {
      setCommentLoadingId(tweetId);
      const created = await withLoad(
        () => api.addComment(token, tweetId, { text, parentCommentId }),
        { global: false },
      );
      setCommentCache((prev) => ({ ...prev, [tweetId]: [...(prev[tweetId] || []), created] }));
      setTweets((prev) => prev.map((tweet) => (
        tweet.id === tweetId ? { ...tweet, commentsCount: (tweet.commentsCount || 0) + 1 } : tweet
      )));
    } catch (x) { setError(x.message); }
    finally { setCommentLoadingId(""); }
  };

  const likeComment = async (tweetId, commentId) => {
    if (!tweetId || !commentId) return;
    const loadingKey = `${tweetId}:${commentId}`;
    if (commentLikeLoadingId === loadingKey) return;
    const source = commentCache[tweetId] || [];
    const current = source.find((comment) => comment.id === commentId);
    if (!current) return;
    const optimisticLiked = !current.likedByMe;
    const optimisticCount = Math.max(0, (current.likesCount || 0) + (optimisticLiked ? 1 : -1));
    setCommentCache((prev) => ({
      ...prev,
      [tweetId]: (prev[tweetId] || []).map((comment) => (
        comment.id === commentId ? { ...comment, likedByMe: optimisticLiked, likesCount: optimisticCount } : comment
      )),
    }));
    try {
      setCommentLikeLoadingId(loadingKey);
      const result = await withLoad(() => api.toggleCommentLike(token, tweetId, commentId), { global: false });
      setCommentCache((prev) => ({
        ...prev,
        [tweetId]: (prev[tweetId] || []).map((comment) => (
          comment.id === commentId ? { ...comment, likedByMe: result.liked, likesCount: result.likesCount } : comment
        )),
      }));
    } catch (x) {
      setCommentCache((prev) => ({
        ...prev,
        [tweetId]: (prev[tweetId] || []).map((comment) => (comment.id === commentId ? current : comment)),
      }));
      setError(x.message);
    } finally {
      setCommentLikeLoadingId("");
    }
  };

  const startEdit = (n) => { setEditingId(n.id); setEditContent(n.content); };
  const saveEdit = async (e, id) => {
    e.preventDefault();
    const content = editContent.trim();
    if (content.length < 2) {
      setError("Tweet content must be at least 2 characters");
      return;
    }
    try { await withLoad(() => api.updateTweet(token, id, { content })); setEditingId(""); await refreshTweets(); } catch (x) { setError(x.message); }
  };
  const delTweet = async (id) => { try { await withLoad(() => api.deleteTweet(token, id)); await refreshTweets(); } catch (x) { setError(x.message); } };

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
  const clearGroupMessages = async () => {
    if (!selectedGroup) return;
    if (!window.confirm("Delete all messages in this group chat?")) return;
    try {
      await withLoad(() => api.clearGroupMessages(token, selectedGroup));
      setGroupMessages([]);
    } catch (x) { setError(x.message); }
  };
  const toggleGroupAutoDelete = async (enabled) => {
    if (!selectedGroup) return;
    try {
      setGroupSettingsSaving(true);
      await withLoad(() => api.updateGroupSettings(token, selectedGroup, { autoDelete24h: enabled }));
      setGroups((prev) => prev.map((g) => (g.id === selectedGroup ? { ...g, autoDelete24h: enabled } : g)));
    } catch (x) { setError(x.message); }
    finally { setGroupSettingsSaving(false); }
  };

  const sendGroup = async (e) => {
    e.preventDefault();
    const text = groupDraft.trim();
    if ((!text && !groupImageData && !groupAudioData && !groupVideoData) || !selectedGroup || groupSending) return;
    try {
      setGroupSending(true);
      const created = await api.sendGroupMessage(token, selectedGroup, {
        text,
        imageData: groupImageData,
        audioData: groupAudioData,
        videoData: groupVideoData,
        replyToMessageId: groupReplyTo?.id || "",
      });
      setGroupMessages((prev) => [...prev, created]);
      setGroupDraft("");
      setGroupImageData("");
      setGroupAudioData("");
      setGroupVideoData("");
      setGroupReplyTo(null);
    }
    catch (x) { setError(x.message); }
    finally { setGroupSending(false); }
  };

  const sendDm = async (e) => {
    e.preventDefault();
    const text = dmDraft.trim();
    if ((!text && !dmImageData && !dmAudioData && !dmVideoData) || !dmTargetUid || dmSending) return;
    try {
      setDmSending(true);
      const created = await api.sendDm(token, dmTargetUid, {
        text,
        imageData: dmImageData,
        audioData: dmAudioData,
        videoData: dmVideoData,
        replyToMessageId: dmReplyTo?.id || "",
      });
      setDmMessages((prev) => [...prev, created]);
      setDmDraft("");
      setDmImageData("");
      setDmAudioData("");
      setDmVideoData("");
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

    if ((notification.type === "tweet_like" || notification.type === "tweet_comment") && notification.tweetId) {
      setFocusedPostId(notification.tweetId);
      const targetTweet = tweets.find((n) => n.id === notification.tweetId);
      if (!targetTweet) {
        navigate("/feed");
        setError("This post is no longer available.");
        return;
      }
      navigate(`/users/${targetTweet.authorUid}`);
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
      setFocusedGroupMessageId(notification.messageId || "");
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
      setFocusedDmMessageId(notification.messageId || "");
      navigate("/dm");
      return;
    }
    navigate("/notifications");
  };

  if (checking) return <div className="center-screen loading-screen"><div className="spinner" /></div>;
  if (!firebaseUser) {
    return (
      <Suspense fallback={<div className="center-screen loading-screen"><div className="spinner" /></div>}>
        <AuthLanding login={login} loginLoading={loginLoading} error={error} />
      </Suspense>
    );
  }
  if (!profile?.fullName || !profile?.nickname || !(profile?.interests || []).length) {
    return (
      <Suspense fallback={<div className="center-screen loading-screen"><div className="spinner" /></div>}>
        <SetupProfile
          firebaseUser={firebaseUser}
          setupNickname={setupNickname}
          setSetupNickname={setSetupNickname}
          setupBio={setupBio}
          setSetupBio={setSetupBio}
          setupInterests={setupInterests}
          setSetupInterests={setSetupInterests}
          saveSetup={saveSetup}
          error={error}
          interestOptions={INTEREST_OPTIONS}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="center-screen loading-screen"><div className="spinner" /></div>}>
      <div className="app-shell">
        <TopNav tabs={TABS} tab={currentTab} setTab={(nextTab) => navigate(`/${nextTab}`)} profile={profile} firebaseUser={firebaseUser} badgeCounts={badgeCounts} />

      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedView tweets={tweets} users={users} editingId={editingId} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit} setEditingId={setEditingId} timeAgo={timeAgo} containsArabic={containsArabic} likeTweet={likeTweet} likeLoadingId={likeLoadingId} commentLoadingId={commentLoadingId} openCommentsModal={openCommentsModal} profile={profile} startEdit={startEdit} delTweet={delTweet} onOpenPublish={() => setShowPublishModal(true)} focusedPostId={focusedPostId} onOpenProfile={(uid) => navigate(`/users/${uid}`)} feedLoading={feedLoading} />} />
        <Route path="/groups" element={<GroupsView isMobile={isMobile} mobileGroupPage={mobileGroupPage} setMobileGroupPage={setMobileGroupPage} showGroupMembers={showGroupMembers} setShowGroupMembers={setShowGroupMembers} groupMessagesLoading={groupMessagesLoading} createGroup={createGroup} groupName={groupName} setGroupName={setGroupName} groupDesc={groupDesc} setGroupDesc={setGroupDesc} joinByCode={joinByCode} inviteCodeInput={inviteCodeInput} setInviteCodeInput={setInviteCodeInput} groups={groups} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} joinOrLeave={joinOrLeave} selectedGroupData={selectedGroupData} groupMessages={groupMessages} profile={profile} timeAgo={timeAgo} setGroupReplyTo={setGroupReplyTo} groupReplyTo={groupReplyTo} groupDraft={groupDraft} setGroupDraft={setGroupDraft} sendGroup={sendGroup} groupSending={groupSending} groupImageData={groupImageData} setGroupImageData={setGroupImageData} groupAudioData={groupAudioData} setGroupAudioData={setGroupAudioData} groupVideoData={groupVideoData} setGroupVideoData={setGroupVideoData} groupMembers={groupMembers} promote={promote} removeMember={removeMember} focusedGroupMessageId={focusedGroupMessageId} onOpenProfile={(uid) => navigate(`/users/${uid}`)} clearGroupMessages={clearGroupMessages} toggleGroupAutoDelete={toggleGroupAutoDelete} groupSettingsSaving={groupSettingsSaving} />} />
        <Route path="/dm" element={<DmView isMobile={isMobile} mobileDmPage={mobileDmPage} setMobileDmPage={setMobileDmPage} dmMessagesLoading={dmMessagesLoading} others={others} dmTargetUid={dmTargetUid} setDmTargetUid={setDmTargetUid} setDmReplyTo={setDmReplyTo} dmMessages={dmMessages} profile={profile} timeAgo={timeAgo} dmReplyTo={dmReplyTo} dmDraft={dmDraft} setDmDraft={setDmDraft} sendDm={sendDm} dmSending={dmSending} dmImageData={dmImageData} setDmImageData={setDmImageData} dmAudioData={dmAudioData} setDmAudioData={setDmAudioData} dmVideoData={dmVideoData} setDmVideoData={setDmVideoData} focusedDmMessageId={focusedDmMessageId} onOpenProfile={(uid) => navigate(`/users/${uid}`)} />} />
        <Route path="/notifications" element={<NotificationsView notifications={unreadNotifications} notifText={notifText} timeAgo={timeAgo} openNotification={openNotification} clearNotifications={clearNotifications} />} />
        <Route path="/profile" element={<ProfileView profile={profile} firebaseUser={firebaseUser} profileDraft={profileDraft} setProfileDraft={setProfileDraft} saveProfile={saveProfile} soundSettings={soundSettings} setSoundSettings={setSoundSettings} theme={theme} setTheme={setTheme} onLogout={logout} interestOptions={INTEREST_OPTIONS} />} />
        <Route path="/users/:uid" element={<UserProfileView profile={profile} users={users} tweets={tweets} editingId={editingId} editContent={editContent} setEditContent={setEditContent} saveEdit={saveEdit} setEditingId={setEditingId} timeAgo={timeAgo} containsArabic={containsArabic} likeTweet={likeTweet} likeLoadingId={likeLoadingId} commentLoadingId={commentLoadingId} openCommentsModal={openCommentsModal} startEdit={startEdit} delTweet={delTweet} onOpenProfile={(uid) => navigate(`/users/${uid}`)} onToggleFollow={toggleFollowUser} focusedPostId={focusedPostId} />} />
      <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <PublishTweetModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        postContent={postContent}
        setPostContent={setPostContent}
        postImageData={postImageData}
        setPostImageData={setPostImageData}
        postAudioData={postAudioData}
        setPostAudioData={setPostAudioData}
        postVideoData={postVideoData}
        setPostVideoData={setPostVideoData}
        postTweet={(e) => {
          postTweet(e);
          setShowPublishModal(false);
        }}
      />

      {pendingLeaveGroupId && <ConfirmLeaveModal onConfirm={confirmLeaveDelete} onCancel={() => setPendingLeaveGroupId("")} />}
      <PostCommentsModal
        isOpen={Boolean(commentsModalTweetId && activeCommentsTweet)}
        onClose={() => setCommentsModalTweetId("")}
        tweet={activeCommentsTweet}
        comments={commentCache[commentsModalTweetId] || []}
        loading={commentLoadingId === commentsModalTweetId}
        sendComment={sendComment}
        likeComment={likeComment}
        commentLikeLoadingId={commentLikeLoadingId}
        profile={profile}
        timeAgo={timeAgo}
        containsArabic={containsArabic}
        onOpenProfile={(uid) => navigate(`/users/${uid}`)}
      />
        {busy && !pendingLeaveGroupId && <div className="loading-overlay" role="status" aria-live="polite"><div className="spinner" /></div>}
      </div>
    </Suspense>
  );
}

export default App;
