require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

app.use(express.json({ limit: "12mb" }));
app.use(express.static(__dirname + "/public"));

app.get("/api/health", (req, res) => {
  res.json({
    name: "GLUF AI",
    status: "online",
    provider: "OpenRouter"
  });
});

app.post("/api/chat", async (req, res) => {
  const body = req.body || {};
  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const attachment = body.attachment;

  if (!message && !attachment) {
    return res.status(400).json({
      error: "Please enter a message or attach a file."
    });
  }

  if (message.length > 4000) {
    return res.status(400).json({
      error: "Please keep your message under 4000 characters."
    });
  }

  if (!API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable.");

    return res.status(503).json({
      error: "GLUF AI is not configured yet. Please check the server environment settings."
    });
  }

  let effectiveMessage = message;
  let attachmentPart = null;

  if (attachment) {
    const allowedImages = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    const allowedText = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json"
    ];

    const isImage =
      typeof attachment.type === "string" &&
      allowedImages.includes(attachment.type);

    const isPdf = attachment.type === "application/pdf";
    const isText =
      typeof attachment.type === "string" &&
      allowedText.includes(attachment.type);

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
      return res.status(400).json({
        error: "The selected file data is invalid."
      });
    }

    if (isText) {
      const fileText = Buffer
        .from(attachment.data, "base64")
        .toString("utf8");

      if (fileText.length > 500000) {
        return res.status(400).json({
          error: "That text document is too large to analyze."
        });
      }

      effectiveMessage =
        (effectiveMessage || "Please analyze this document.") +
        "\n\nDocument: " + attachment.name.slice(0, 150) +
        "\n\n" + fileText;
    } else if (isImage) {
      attachmentPart = {
        type: "image_url",
        image_url: {
          url: "data:" +
            attachment.type +
            ";base64," +
            attachment.data
        }
      };

      effectiveMessage =
        effectiveMessage || "Please describe and analyze this image.";
    } else if (isPdf) {
      attachmentPart = {
        type: "file",
        file: {
          filename: attachment.name.slice(0, 150),
          file_data: attachment.data
        }
      };

      effectiveMessage =
        effectiveMessage || "Please analyze this PDF document.";
    }
  }

  const history = Array.isArray(body.history)
    ? body.history
    : [];

  const safeHistory = history
    .filter(item =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.text === "string"
    )
    .slice(-10)
    .map(item => ({
      role: item.role,
      content: item.text.slice(0, 1000)
    }));

  const memory =
    typeof body.memory === "string"
      ? body.memory.slice(0, 5000)
      : "";

  const systemPrompt =
    "You are GLUF AI, a helpful, honest, friendly general-purpose AI assistant. " +
    "Answer the user's latest message clearly and accurately. " +
    "Use relevant conversation history and memory when provided. " +
    "If you are uncertain, say so. Do not invent facts.";

  const messages = [
    {
      role: "system",
      content: systemPrompt +
        (memory ? "\n\nRelevant remembered information:\n" + memory : "")
    },
    ...safeHistory,
    {
      role: "user",
      content: attachmentPart
        ? [
            { type: "text", text: effectiveMessage },
            attachmentPart
          ]
        : effectiveMessage
    }
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + API_KEY,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "GLUF AI"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(60000)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const providerMessage =
        result.error?.message ||
        result.message ||
        "Unknown provider error";

      console.error(
        "OpenRouter request failed:",
        response.status,
        providerMessage
      );

      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          error: "OpenRouter rejected the API key or access. Check your key and account."
        });
      }

      if (response.status === 429) {
        return res.status(502).json({
          error: "The AI provider's usage limit has been reached. Please try later or check your OpenRouter account limits."
        });
      }

      return res.status(502).json({
        error: "OpenRouter could not complete the request. Check the server logs for details."
      });
    }

    const reply = result.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      console.error(
        "OpenRouter returned no text:",
        JSON.stringify(result).slice(0, 1500)
      );

      return res.status(502).json({
        error: "The AI provider returned no text. Please try again."
      });
    }

    return res.json({ reply: reply.trim() });

  } catch (error) {
    console.error(
      "OpenRouter connection failed:",
      error.name,
      error.message
    );

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "The AI request timed out. Please try again."
      });
    }

    return res.status(502).json({
      error: "GLUF AI could not connect to the AI provider. Please try again."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("GLUF AI server running on port " + PORT);
  console.log("AI provider: OpenRouter");
  console.log("Configured model: " + MODEL);
});