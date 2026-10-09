/* ==========================================================================
   ConnecFriend — news post card, shared by the feed and the profile page.
   Each card shows the friend's name, profile picture, time since their last
   login, the news itself, who it was shared with, and like/dislike counts.
   ========================================================================== */

const Posts = (() => {
  const { escapeHtml, avatar, timeAgo, isActive } = UI;

  function audienceLabel(post) {
    if (post.audience === "all") {
      return `<span class="text-body-secondary" data-bs-toggle="tooltip" data-bs-title="Shared with all friends"><i class="bi bi-people-fill"></i></span>`;
    }
    const names = post.audience.map((id) => Store.getUser(id)?.name).filter(Boolean).join(", ");
    return `<span class="text-body-secondary" data-bs-toggle="tooltip" data-bs-title="Shared only with: ${escapeHtml(names)}">
      <i class="bi bi-person-lock"></i> ${post.audience.length}</span>`;
  }

  function card(post, me) {
    const author = Store.getUser(post.author);
    if (!author) return "";
    const mine = post.author === me.id;
    const liked = post.likes.includes(me.id);
    const disliked = post.dislikes.includes(me.id);
    const loginInfo = mine
      ? `<span class="badge text-bg-light border fw-normal">You</span>`
      : `<span class="badge ${isActive(author) ? "text-bg-success" : "text-bg-light border"} fw-normal"
           data-bs-toggle="tooltip" data-bs-title="Time since ${escapeHtml(author.name.split(" ")[0])} last logged in">
           <i class="bi bi-clock-history me-1"></i>Last login ${timeAgo(author.lastLogin)}</span>`;

    return `
    <article class="card border-0 shadow-sm" data-post="${post.id}">
      <div class="card-body p-3 p-md-4">
        <header class="d-flex align-items-start gap-3 mb-3">
          <a href="profile.html?id=${author.id}" class="flex-shrink-0">${avatar(author, 46)}</a>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex flex-wrap align-items-center gap-2">
              <a href="profile.html?id=${author.id}" class="fw-semibold text-body text-decoration-none">${escapeHtml(author.name)}</a>
              ${loginInfo}
            </div>
            <div class="small text-body-secondary d-flex align-items-center gap-2 mt-1">
              <span>Posted ${timeAgo(post.createdAt)}</span><span aria-hidden="true">·</span>${audienceLabel(post)}
            </div>
          </div>
          ${mine ? `<div class="dropdown">
              <button class="btn btn-sm btn-light" data-bs-toggle="dropdown" aria-label="Post options"><i class="bi bi-three-dots"></i></button>
              <ul class="dropdown-menu dropdown-menu-end"><li><button class="dropdown-item text-danger" data-delete="${post.id}"><i class="bi bi-trash me-2"></i>Delete news</button></li></ul>
            </div>` : ""}
        </header>

        <p class="post-text mb-3">${escapeHtml(post.text)}</p>

        <footer class="d-flex align-items-center gap-2 border-top pt-3">
          <button type="button" class="btn btn-sm ${liked ? "btn-success" : "btn-outline-success"} rounded-pill px-3"
                  data-react="like" data-id="${post.id}" aria-pressed="${liked}" aria-label="Like">
            <i class="bi ${liked ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-up"} me-1"></i><span>${post.likes.length}</span>
          </button>
          <button type="button" class="btn btn-sm ${disliked ? "btn-danger" : "btn-outline-danger"} rounded-pill px-3"
                  data-react="dislike" data-id="${post.id}" aria-pressed="${disliked}" aria-label="Dislike">
            <i class="bi ${disliked ? "bi-hand-thumbs-down-fill" : "bi-hand-thumbs-down"} me-1"></i><span>${post.dislikes.length}</span>
          </button>
          <span class="small text-body-secondary ms-auto">${post.likes.length} like${post.likes.length === 1 ? "" : "s"} · ${post.dislikes.length} dislike${post.dislikes.length === 1 ? "" : "s"}</span>
        </footer>
      </div>
    </article>`;
  }

  // Like / dislike / delete for every card inside root. onChange re-renders the list.
  function bind(root, onChange) {
    root.addEventListener("click", async (e) => {
      const reactBtn = e.target.closest("[data-react]");
      const deleteBtn = e.target.closest("[data-delete]");
      try {
        if (reactBtn) {
          reactBtn.disabled = true;
          await Store.react(reactBtn.dataset.id, reactBtn.dataset.react);
          onChange();
        } else if (deleteBtn) {
          if (await UI.confirmDialog("Delete this news?", "It will be removed for everyone you shared it with.", "Delete")) {
            await Store.deletePost(deleteBtn.dataset.delete);
            UI.toast("Your news was deleted.", "success");
            onChange();
          }
        }
      } catch (err) {
        UI.showError(err);
        if (reactBtn) reactBtn.disabled = false;
      }
    });
  }

  function emptyState(text, actionHtml = "") {
    return `<div class="card border-0 shadow-sm"><div class="card-body text-center py-5">
      <i class="bi bi-newspaper display-6 text-body-tertiary"></i>
      <p class="text-body-secondary mt-3 mb-3">${escapeHtml(text)}</p>${actionHtml}</div></div>`;
  }

  return { card, bind, emptyState };
})();
