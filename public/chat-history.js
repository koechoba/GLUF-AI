(() => {
  const CURRENT = "gluf_ai_conversation_v1";
  const CHATS = "gluf_ai_chats_v1";

  const list = document.getElementById("gluf-chat-list");
  const newButton = document.getElementById("gluf-new-chat");

  if (!list || !newButton) return;

  let switching = false;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getChats() {
    const chats = read(CHATS, []);
    return Array.isArray(chats) ? chats : [];
  }

  function currentMessages() {
    const messages = read(CURRENT, []);
    return Array.isArray(messages) ? messages : [];
  }

  function makeTitle(messages) {
    const first = messages.find(
      message => message.role === "user"
    );
    return first
      ? first.text.slice(0, 42) +
        (first.text.length > 42 ? "…" : "")
      : "New Chat";
  }

  function saveCurrent() {
    if (switching) return;

    const messages = currentMessages();
    if (!messages.length) return;

    let chats = getChats();
    let activeId = localStorage.getItem("gluf_ai_active_chat");

    let active = chats.find(chat => chat.id === activeId);

    if (!active) {
      active = {
        id: String(Date.now()),
        title: makeTitle(messages),
        messages: messages,
        updatedAt: Date.now()
      };
      activeId = active.id;
      localStorage.setItem("gluf_ai_active_chat", activeId);
      chats.unshift(active);
    } else {
      active.title = makeTitle(messages);
      active.messages = messages;
      active.updatedAt = Date.now();
      chats = [active, ...chats.filter(chat => chat.id !== active.id)];
    }

    localStorage.setItem(
      CHATS,
      JSON.stringify(chats.slice(0, 50))
    );

    render();
  }

  function render() {
    const chats = getChats();
    list.replaceChildren();

    if (!chats.length) {
      const empty = document.createElement("p");
      empty.textContent = "Your previous chats will appear here.";
      list.appendChild(empty);
      return;
    }

    const activeId = localStorage.getItem("gluf_ai_active_chat");

    chats.forEach(chat => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;gap:5px;align-items:center";

      const open = document.createElement("button");
      open.className = "sidebar-action";
      open.textContent = chat.title || "Untitled chat";
      open.style.cssText =
        "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
        (chat.id === activeId ? "border-color:#5685ff;" : "");

      open.onclick = () => {
        switching = true;
        localStorage.setItem(CURRENT, JSON.stringify(chat.messages));
        localStorage.setItem("gluf_ai_active_chat", chat.id);
        location.reload();
      };

      const remove = document.createElement("button");
      remove.className = "close-sidebar";
      remove.textContent = "×";
      remove.title = "Delete this chat";
      remove.setAttribute("aria-label", "Delete " + chat.title);

      remove.onclick = () => {
        if (!confirm("Delete this conversation?")) return;

        const remaining = getChats().filter(item => item.id !== chat.id);
        localStorage.setItem(CHATS, JSON.stringify(remaining));

        if (localStorage.getItem("gluf_ai_active_chat") === chat.id) {
          localStorage.removeItem(CURRENT);
          localStorage.removeItem("gluf_ai_active_chat");
    localStorage.removeItem("gluf_ai_cloud_chat_id");
          location.reload();
          return;
        }

        render();
      };

      row.append(open, remove);
      list.appendChild(row);
    });
  }

  newButton.addEventListener("click", event => {
    event.preventDefault();
    saveCurrent();
    localStorage.removeItem(CURRENT);
    localStorage.removeItem("gluf_ai_active_chat");
    localStorage.removeItem("gluf_ai_cloud_chat_id");
    location.reload();
  });

  // Keep the list updated as messages are saved.
  window.addEventListener("storage", render);
  setInterval(saveCurrent, 1000);
  render();
})();
