const cors = require("cors");
require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

app.use(express.static(__dirname + "/public"));

app.get("/api/health", (req, res) => {
  res.json({
    name: "GLUF AI",
    status: "online"
  });
});

app.post("/api/chat", async (req, res) => {
  const message = req.body && req.body.message;
  const attachment = req.body && req.body.attachment;

  if (typeof message !== "string" || (!message.trim() && !attachment)) {
    return res.status(400).json({
      error: "Please enter a message or attach a file."
    });
  }

  if (message.length > 4000) {
    return res.status(400).json({
      error: "Please keep your message under 4000 characters."
    });
  }

  // GLUF_MEDIA_INPUT
  let mediaInput = null;
  let effectiveMessage = message.trim();

  if (attachment) {
    const allowedImages = [
      "image/jpeg", "image/png", "image/webp", "image/gif"
    ];
    const isPdf = attachment.type === "application/pdf";
    const isImage = allowedImages.includes(attachment.type);
    const isText = [
      "text/plain", "text/markdown", "text/csv",
      "application/json"
    ].includes(attachment.type);

    if (
      typeof attachment.name !== "string" ||
      typeof attachment.data !== "string" ||
      attachment.data.length > 10 * 1024 * 1024 ||
      !(isImage || isPdf || isText)
    ) {
      return res.status(400).json({
        error: "Unsupported file. Choose an image, PDF, TXT, MD, CSV, or JSON file under 7 MB."
      });
    }

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data)) {
      return res.status(400).json({ error: "The selected file data is invalid." });
    }

    if (isText) {
      const fileText = Buffer.from(attachment.data, "base64").toString("utf8");
      if (fileText.length > 500000) {
        return res.status(400).json({ error: "That text document is too large to analyze." });
      }
      effectiveMessage = (effectiveMessage || "Please analyze this document.") +
        "\n\nDocument: " + attachment.name.slice(0, 150) +
        "\n\n" + fileText;
    } else {
      mediaInput = {
        type: isPdf ? "document" : "image",
        data: attachment.data,
        mime_type: attachment.type
      };
    }
  }

  if (message.length > 4000) {
    return res.status(400).json({
      error: "Please keep your message under 4000 characters."
    });
  }

  const history = Array.isArray(req.body.history)
    ? req.body.history
    : [];

  const safeHistory = history
    .filter(item =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.text === "string"
    )
    .slice(-10)
    .map(item =>
      (item.role === "user" ? "User" : "GLUF AI") +
      ": " + item.text.slice(0, 1000)
    )
    .join("\n");

  const LONG_TERM_MEMORY = typeof req.body.memory === "string" ? req.body.memory.slice(0, 5000) : ""; 

  const prompt = safeHistory
    ? "Recent conversation:\n" + safeHistory +
      "\n\nLatest user message: " + message.trim() +
      "\nRespond to the latest message as GLUF AI."
    : (message.trim());

  try {
    const memoryContext = LONG_TERM_MEMORY ? "Known facts remembered from earlier conversations (use only when relevant):\\n" + LONG_TERM_MEMORY + "\\n\\n" : ""; 
    const finalPrompt = memoryContext + prompt;

    const interactionInput = mediaInput
      ? [{ type: "text", text: finalPrompt }, mediaInput]
      : finalPrompt;

    const response = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: interactionInput,
      system_instruction:
        "You are GLUF AI, a helpful, honest, friendly general-purpose AI assistant. Use the supplied recent conversation to understand follow-up questions. Explain things clearly and admit uncertainty when appropriate."
    });

    res.json({
      reply: response.output_text ||
        "I couldn't generate a text response. Please try again."
    });
  } catch (error) {
    console.error("Gemini request failed:", error.message);

    res.status(502).json({
      error: "GLUF AI could not get a response. Please check the server log."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "GLUF AI server running at http://127.0.0.1:" + PORT
  );
});
