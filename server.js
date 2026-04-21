import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI, { toFile } from "openai";

dotenv.config();

const app = express();

app.use(cors());

// ✅ Increased upload limit to 50MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Root route (for quick test)
app.get("/", (req, res) => {
  res.status(200).send("AI Image Editor Backend is running 🚀");
});

// ✅ Health check
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// ✅ Image edit endpoint
app.post("/edit-image", upload.single("image"), async (req, res) => {
  try {
    // 🔑 Check API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on the server."
      });
    }

    // 📷 Check file
    if (!req.file) {
      return res.status(400).json({
        error: "No image file was uploaded."
      });
    }

    // ✏️ Check prompt
    const prompt = req.body.prompt?.trim();
    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required."
      });
    }

    // ✅ Validate file type
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: `Unsupported image type: ${req.file.mimetype}. Use PNG, JPG, or WEBP.`
      });
    }

    // 🧾 Convert buffer to file
    const imageFile = await toFile(
      req.file.buffer,
      req.file.originalname || "upload.png",
      { type: req.file.mimetype }
    );

    // 🧠 Strong prompt control
    const strongPrompt = [
      prompt,
      "Preserve the original composition, pose, people, dog, background, lighting, and all clothing unless explicitly changed.",
      "Make only the requested edit.",
      "Do not redesign the scene."
    ].join(" ");

    // 🎨 Call OpenAI image edit
    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: strongPrompt,
      size: "1024x1536"
    });

    const imageBase64 = result?.data?.[0]?.b64_json;

    if (!imageBase64) {
      return res.status(500).json({
        error: "OpenAI returned no edited image."
      });
    }

    return res.status(200).json({
      imageBase64
    });

  } catch (error) {
    console.error("🔥 EDIT IMAGE ERROR:");
    console.error(JSON.stringify(error, null, 2));

    const message =
      error?.error?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown server error.";

    return res.status(500).json({
      error: message
    });
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});