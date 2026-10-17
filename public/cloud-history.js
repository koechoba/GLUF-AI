(() => {
  const list = document.getElementById("gluf-cloud-chat-list");
  if (!list) return;

  async function loadCloudChats() {
    list.replaceChildren();
    const status = document.createElement("p");
    status.textContent = "Loading cloud chats...";
    list.appendChild(status);

    try {
      const chats = await window.GLUF_CLOUD.listChats();
      list.replaceChildren();

      if (!chats.length) {
        status.textContent = "No cloud chats yet.";
        list.appendChild(status);
        return;
      }

      chats.forEach(chat => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:5px;margin-bottom:6px";

        const open = document.createElement("button");
        open.className = "sidebar-action";
        open.textContent = chat.title || "New Chat";
        open.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis";
        open.onclick = async () => {
          open.disabled = true;
          open.textContent = "Opening...";
          try {
            const messages = await window.GLUF_CLOUD.openChat(chat.id);
            localStorage.setItem("gluf_ai_conversation_v1", JSON.stringify(messages));
            localStorage.setItem("gluf_ai_cloud_chat_id", chat.id);
            localStorage.removeItem("gluf_ai_active_chat");
            window.dispatchEvent(new CustomEvent("gluf:open-cloud-chat", { detail: messages }));
            await loadCloudChats();
          } catch (error) {
            alert("Could not open chat: " + error.message);
            open.disabled = false;
            open.textContent = chat.title || "New Chat";
          }
        };

        const remove = document.createElement("button");
        remove.className = "close-sidebar";
        remove.textContent = "×";
        remove.title = "Delete cloud chat";
        remove.onclick = async () => {
          if (!confirm("Delete this cloud conversation?")) return;
          try {
            await window.GLUF_CLOUD.deleteChat(chat.id);
            await loadCloudChats();
          } catch (error) {
            alert("Could not delete chat: " + error.message);
          }
        };

        row.append(open, remove);
        list.appendChild(row);
      });
    } catch (error) {
      list.replaceChildren();
      const message = document.createElement("p");
      message.textContent = error.message || "Could not load cloud chats.";
      list.appendChild(message);
    }
  }

  window.GLUF_LOAD_CLOUD_CHATS = loadCloudChats;
  loadCloudChats();

  if (window.GLUF_AUTH_CLIENT) {
    window.GLUF_AUTH_CLIENT.auth.onAuthStateChange(() => {
      setTimeout(loadCloudChats, 300);
    });
  }
})();
