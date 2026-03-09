import { useMemo } from "react";
import { useParams } from "react-router-dom";
import FeedView from "./FeedView";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;

export default function UserProfileView({
  profile,
  users,
  tweets,
  editingId,
  editContent,
  setEditContent,
  saveEdit,
  setEditingId,
  timeAgo,
  containsArabic,
  likeTweet,
  likeLoadingId,
  commentLoadingId,
  openCommentsModal,
  startEdit,
  delTweet,
  onOpenProfile,
  onToggleFollow,
  focusedPostId,
}) {
  const { uid = "" } = useParams();
  const viewed = useMemo(() => {
    if (!uid) return null;
    if (profile?.uid === uid) return profile;
    return users.find((u) => u.uid === uid) || null;
  }, [uid, profile, users]);

  const userTweets = useMemo(
    () => tweets.filter((tweet) => tweet.authorUid === uid),
    [tweets, uid],
  );
  const isSelf = viewed?.uid === profile?.uid;

  if (!viewed) {
    return (
      <section className="feed-layout-full">
        <article className="panel">
          <h3>User profile</h3>
          <p className="empty-messages">This user is not available.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="feed-layout-full">
      <article className="panel profile-summary-panel">
        <div className="profile-box">
          <img src={pickAvatar(viewed.photoURL, viewed.photoUrl)} alt={viewed.nickname} className="avatar-lg" />
          <p><strong>{isSelf ? "You" : (viewed.fullName || viewed.nickname || "User")}</strong></p>
          <p>@{isSelf ? "you" : (viewed.nickname || "unknown")}</p>
          <p>{viewed.bio || "No bio"}</p>
          <p>{viewed.followerCount || 0} followers • {viewed.followingCount || 0} following</p>
          {!isSelf && (
            <button type="button" className="primary-btn" onClick={() => onToggleFollow?.(viewed.uid)}>
              {viewed.isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
        </div>
      </article>
      <FeedView
        tweets={userTweets}
        editingId={editingId}
        editContent={editContent}
        setEditContent={setEditContent}
        saveEdit={saveEdit}
        setEditingId={setEditingId}
        timeAgo={timeAgo}
        containsArabic={containsArabic}
        likeTweet={likeTweet}
        likeLoadingId={likeLoadingId}
        commentLoadingId={commentLoadingId}
        openCommentsModal={openCommentsModal}
        profile={profile}
        startEdit={startEdit}
        delTweet={delTweet}
        onOpenPublish={() => {}}
        users={users}
        focusedPostId={focusedPostId}
        onOpenProfile={onOpenProfile}
        title={isSelf ? "Your Tweets" : `${viewed.nickname || "User"}'s Tweets`}
        showPublish={false}
        emptyText="No tweets by this user yet."
      />
    </section>
  );
}
