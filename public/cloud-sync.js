window.GLUF_CLOUD = { ready: true };
window.GLUF_CLOUD.listChats = async function () {
  const db = window.GLUF_AUTH_CLIENT;
  if (!db) throw new Error("Supabase is not ready");
  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error("Please sign in first");
  }
  const { data, error } = await db
    .from("chats")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
};
window.GLUF_CLOUD.createChat = async function (title) {
  const db = window.GLUF_AUTH_CLIENT;
  if (!db) throw new Error("Supabase is not ready");
  const { data: result, error: authError } =
    await db.auth.getUser();
  if (authError) throw authError;
  if (!result.user) throw new Error("Please sign in first");

  const { data, error } = await db
    .from("chats")
    .insert({
      user_id: result.user.id,
      title: title || "New Chat"
    })
    .select("id,title,created_at,updated_at")
    .single();

  if (error) throw error;
  return data;
};
window.GLUF_CLOUD.saveMessages = async function (chatId, messages) {
  const db = window.GLUF_AUTH_CLIENT;
  if (!db) throw new Error("Supabase is not ready");

  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error("Please sign in first");
  if (!Array.isArray(messages) || messages.length === 0) return;

  const rows = messages
    .filter(m => m && ["user", "assistant"].includes(m.role)
      && typeof m.text === "string")
    .map(m => ({
      chat_id: chatId,
      role: m.role,
      content: m.text
    }));

  if (!rows.length) return;

  const { error } = await db.from("messages").insert(rows);
  if (error) throw error;
};
window.GLUF_CLOUD.openChat = async function (chatId) {
  const db = window.GLUF_AUTH_CLIENT;
  if (!db) throw new Error("Supabase is not ready");

  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error("Please sign in first");

  const { data, error } = await db
    .from("messages")
    .select("role,content,created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map(m => ({
    role: m.role,
    text: m.content
  }));
};
window.GLUF_CLOUD.deleteChat = async function (chatId) {
  const db = window.GLUF_AUTH_CLIENT;
  if (!db) throw new Error("Supabase is not ready");

  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error("Please sign in first");

  const { error } = await db
    .from("chats")
    .delete()
    .eq("id", chatId);

  if (error) throw error;
  return true;
};
