import { Capacitor, CapacitorHttp } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();
const isWeb = !isNative && typeof window !== "undefined";
const isVercelHost = isWeb && window.location.hostname.endsWith(".vercel.app");
const forceSameOriginApi = (import.meta.env.VITE_FORCE_SAME_ORIGIN_API || "").toLowerCase() === "true";
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const defaultVercelApiBaseUrl = "https://mega-novels.vercel.app";

// Resolution order:
// 1) explicit VITE_API_BASE_URL (always wins)
// 2) on Vercel web, default to known API origin unless same-origin is forced
// 3) local fallback
const inferredVercelApiBaseUrl = isWeb && isVercelHost ? defaultVercelApiBaseUrl : "";
export const API_BASE_URL = forceSameOriginApi
  ? ""
  : (configuredApiBaseUrl || inferredVercelApiBaseUrl || "http://localhost:4000");

async function request(path, token, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const method = options.method || "GET";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: options.body ? JSON.parse(options.body) : undefined,
      });

      const data = response.data ?? {};
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(data.error || `Request failed for ${url}`);
        error.status = response.status;
        error.payload = data;
        error.url = url;
        error.path = path;
        throw error;
      }

      return data;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `Request failed for ${url}`);
      error.status = response.status;
      error.payload = data;
      error.url = url;
      error.path = path;
      throw error;
    }

    return data;
  } catch (error) {
    if (error?.url) throw error;
    const nextError = new Error(`Network request failed for ${url}`);
    nextError.cause = error;
    nextError.url = url;
    nextError.path = path;
    throw nextError;
  }
}

export const api = {
  me: (token) => request("/api/profiles/me", token),
  saveProfile: (token, payload) => request("/api/profiles/me", token, { method: "POST", body: JSON.stringify(payload) }),
  users: (token) => request("/api/profiles", token),
  toggleFollow: (token, uid) => request(`/api/profiles/${uid}/follow`, token, { method: "POST" }),
  notifications: (token) => request("/api/notifications", token),
  presenceView: (token, payload) => request("/api/presence/view", token, { method: "POST", body: JSON.stringify(payload) }),
  markNotificationRead: (token, notificationId) =>
    request("/api/notifications/read", token, { method: "POST", body: JSON.stringify({ notificationId }) }),
  clearNotifications: (token) => request("/api/notifications/clear", token, { method: "POST" }),
  tweets: (token, { limit, since } = {}) =>
    request(`/api/tweets?${new URLSearchParams({ ...(limit ? { limit: String(limit) } : {}), ...(since ? { since } : {}) })}`, token),
  createTweet: (token, payload) => request("/api/tweets", token, { method: "POST", body: JSON.stringify(payload) }),
  updateTweet: (token, tweetId, payload) => request(`/api/tweets/${tweetId}`, token, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTweet: (token, tweetId) => request(`/api/tweets/${tweetId}`, token, { method: "DELETE" }),
  toggleLike: (token, tweetId) => request(`/api/tweets/${tweetId}/like`, token, { method: "POST" }),
  tweetLikes: (token, tweetId) => request(`/api/tweets/${tweetId}/likes`, token),
  comments: (token, tweetId) => request(`/api/tweets/${tweetId}/comments`, token),
  addComment: (token, tweetId, payload) => request(`/api/tweets/${tweetId}/comments`, token, { method: "POST", body: JSON.stringify(payload) }),
  updateComment: (token, tweetId, commentId, payload) =>
    request(`/api/tweets/${tweetId}/comments/${commentId}`, token, { method: "PUT", body: JSON.stringify(payload) }),
  toggleCommentLike: (token, tweetId, commentId) => request(`/api/tweets/${tweetId}/comments/${commentId}/like`, token, { method: "POST" }),
  groups: (token) => request("/api/groups", token),
  createGroup: (token, payload) => request("/api/groups", token, { method: "POST", body: JSON.stringify(payload) }),
  joinGroup: (token, groupId) => request(`/api/groups/${groupId}/join`, token, { method: "POST" }),
  leaveGroup: (token, groupId, confirmDelete = false) =>
    request(`/api/groups/${groupId}/join`, token, { method: "POST", body: JSON.stringify({ confirmDelete }) }),
  joinByCode: (token, inviteCode) => request("/api/groups/join-by-code", token, { method: "POST", body: JSON.stringify({ inviteCode }) }),
  groupMembers: (token, groupId) => request(`/api/groups/${groupId}/members`, token),
  promoteAdmin: (token, groupId, memberUid) => request(`/api/groups/${groupId}/admins/${memberUid}`, token, { method: "POST" }),
  removeMember: (token, groupId, memberUid) => request(`/api/groups/${groupId}/remove/${memberUid}`, token, { method: "POST" }),
  groupMessages: (token, groupId) => request(`/api/groups/${groupId}/messages`, token),
  clearGroupMessages: (token, groupId) => request(`/api/groups/${groupId}/messages/clear`, token, { method: "POST" }),
  updateGroupSettings: (token, groupId, payload) => request(`/api/groups/${groupId}/settings`, token, { method: "POST", body: JSON.stringify(payload) }),
  sendGroupMessage: (token, groupId, payload) =>
    request(`/api/groups/${groupId}/messages`, token, { method: "POST", body: JSON.stringify(payload) }),
  dmMessages: (token, otherUid) => request(`/api/dms/${otherUid}`, token),
  sendDm: (token, otherUid, payload) => request(`/api/dms/${otherUid}`, token, { method: "POST", body: JSON.stringify(payload) }),
};
