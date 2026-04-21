import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(cors());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Image edit server is running."
  });
});

app.post("/edit-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    const prompt = req.body.prompt?.trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const mimeType = req.file.mimetype || "image/png";
    const imageBase64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const imageResponse = await fetch(dataUrl);
    const imageBlob = await imageResponse.blob();

    const strongPrompt = [
      prompt,
      "Preserve the original composition, people, dog, pose, background, lighting, and clothing unless explicitly changed.",
      "Make only the requested edit."
    ].join(" ");

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageBlob,
      prompt: strongPrompt,
      size: "1024x1536"
    });

    const editedBase64 = result?.data?.[0]?.b64_json;

    if (!editedBase64) {
      return res.status(500).json({ error: "No image returned from OpenAI." });
    }

    return res.json({ imageBase64: editedBase64 });
  } catch (error) {
    console.error("Image edit error:", error);
    return res.status(500).json({
      error: error?.error?.message || error?.message || "Unknown server error."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
