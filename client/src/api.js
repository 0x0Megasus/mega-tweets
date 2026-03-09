const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export const api = {
  me: (token) => request("/api/profiles/me", token),
  saveProfile: (token, payload) => request("/api/profiles/me", token, { method: "POST", body: JSON.stringify(payload) }),
  users: (token) => request("/api/profiles", token),
  notifications: (token) => request("/api/notifications", token),
  presenceView: (token, payload) => request("/api/presence/view", token, { method: "POST", body: JSON.stringify(payload) }),
  markNotificationRead: (token, notificationId) =>
    request("/api/notifications/read", token, { method: "POST", body: JSON.stringify({ notificationId }) }),
  clearNotifications: (token) => request("/api/notifications/clear", token, { method: "POST" }),
  tweets: (token) => request("/api/tweets", token),
  createTweet: (token, payload) => request("/api/tweets", token, { method: "POST", body: JSON.stringify(payload) }),
  updateTweet: (token, tweetId, payload) => request(`/api/tweets/${tweetId}`, token, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTweet: (token, tweetId) => request(`/api/tweets/${tweetId}`, token, { method: "DELETE" }),
  toggleLike: (token, tweetId) => request(`/api/tweets/${tweetId}/like`, token, { method: "POST" }),
  comments: (token, tweetId) => request(`/api/tweets/${tweetId}/comments`, token),
  addComment: (token, tweetId, text) => request(`/api/tweets/${tweetId}/comments`, token, { method: "POST", body: JSON.stringify({ text }) }),
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
  sendGroupMessage: (token, groupId, payload) =>
    request(`/api/groups/${groupId}/messages`, token, { method: "POST", body: JSON.stringify(payload) }),
  dmMessages: (token, otherUid) => request(`/api/dms/${otherUid}`, token),
  sendDm: (token, otherUid, payload) => request(`/api/dms/${otherUid}`, token, { method: "POST", body: JSON.stringify(payload) }),
};
