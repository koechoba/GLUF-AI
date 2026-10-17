(() => {
  const supabaseUrl = window.GLUF_SUPABASE_URL;
  const supabaseKey = window.GLUF_SUPABASE_KEY;

  if (!window.supabase || !supabaseUrl || !supabaseKey) {
    console.error("GLUF AI: Supabase configuration is missing.");
    return;
  }

  const client = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

  const box = document.createElement("div");
  box.id = "gluf-auth";
  box.style.cssText =
    "padding:12px;text-align:center;background:#172033;color:white";

  box.innerHTML = `
    <span id="gluf-auth-status">Not signed in</span>
    <button id="gluf-signin">Sign In</button>
    <button id="gluf-register">Create Account</button>
    <button id="gluf-signout" hidden>Sign Out</button>
    <form id="gluf-auth-form" hidden style="padding:12px">
      <input id="gluf-email" type="email"
        placeholder="Email address" required>
      <input id="gluf-password" type="password"
        placeholder="Password (at least 6 characters)"
        minlength="6" required>
      <button id="gluf-submit" type="submit">Continue</button>
      <button id="gluf-cancel" type="button">Cancel</button>
      <p id="gluf-auth-message"></p>
    </form>
  `;

  
  const accountSlot = document.getElementById("gluf-account-slot");
  if (!accountSlot) {
    console.error("GLUF AI: Account section not found.");
    return;
  }
  accountSlot.appendChild(box);
  box.style.cssText = "padding:8px 0;text-align:left;background:transparent;color:white";
  const style = document.createElement("style");
  style.textContent = "#gluf-auth-form[hidden]{display:none!important} #gluf-auth-form input{width:100%;min-width:0}";
  document.head.appendChild(style);


  const form = document.getElementById("gluf-auth-form");
  const status = document.getElementById("gluf-auth-status");
  const message = document.getElementById("gluf-auth-message");
  let mode = "login";

  function showForm(newMode) {
    mode = newMode;
    form.hidden = false;
    message.textContent = "";
    document.getElementById("gluf-submit").textContent =
      mode === "login" ? "Sign In" : "Create Account";
  }

  document.getElementById("gluf-signin").onclick =
    () => showForm("login");

  document.getElementById("gluf-register").onclick =
    () => showForm("register");

  document.getElementById("gluf-cancel").onclick = () => {
    form.hidden = true;
  };

  document.getElementById("gluf-signout").onclick =
    async () => {
      const { error } = await client.auth.signOut();
      message.textContent = error ? error.message : "";
    };

  form.onsubmit = async (event) => {
    event.preventDefault();
    message.textContent = "Please wait...";

    const email =
      document.getElementById("gluf-email").value.trim();
    const password =
      document.getElementById("gluf-password").value;

    let result;

    if (mode === "register") {
      result = await client.auth.signUp({ email, password });
    } else {
      result = await client.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      message.textContent = result.error.message;
      return;
    }

    if (mode === "register" && !result.data.session) {
      message.textContent =
        "Account created. Check your email to confirm it.";
      return;
    }

    message.textContent = "Success!";
    form.hidden = true;
  };

  client.auth.onAuthStateChange((_event, session) => {
    const signedIn = Boolean(session?.user);

    status.textContent = signedIn
      ? "Signed in: " + session.user.email
      : "Not signed in";

    document.getElementById("gluf-signin").hidden = signedIn;
    document.getElementById("gluf-register").hidden = signedIn;
    document.getElementById("gluf-signout").hidden = !signedIn;
  });

  client.auth.getSession().then(({ data }) => {
    const session = data.session;
    const signedIn = Boolean(session?.user
);

    status.textContent = signedIn
      ? "Signed in: " + session.user.email
      : "Not signed in";

    document.getElementById("gluf-signin").hidden = signedIn;
    document.getElementById("gluf-register").hidden = signedIn;
    document.getElementById("gluf-signout").hidden = !signedIn;
  });

  window.GLUF_AUTH_CLIENT = client;
})();
