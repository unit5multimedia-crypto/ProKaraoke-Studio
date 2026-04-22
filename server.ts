import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import fs from "fs";

// Load .env explicitly from the current working directory
const envPath = path.resolve(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);
const envResult = dotenv.config({ path: envPath });

console.log("--- ProKaraoke Environment Diagnostic ---");
console.log("Current Directory:", process.cwd());
console.log(".env Path:", envPath);
console.log(".env Exists:", envExists);
if (envExists) {
  const stats = fs.statSync(envPath);
  console.log(".env Size:", stats.size, "bytes");
}
if (envResult.error) {
  console.log(".env Load Error:", envResult.error.message);
}
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? `Found (${process.env.GOOGLE_CLIENT_ID.substring(0, 5)}...)` : "MISSING");
console.log("-----------------------------------------");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: "*" } }); // Setup WebSocket relay

  const PORT = 3000;

  // Websocket relay logic: when the Operator sends a message, bounce it to all other connected clients (OBS / Tabs)
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    // Relay exact message to all OTHER clients
    socket.on("karaoke-sync", (data) => {
      socket.broadcast.emit("karaoke-sync", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Use trust proxy since we are behind a proxy (AI Studio/Cloud Run)
  app.set("trust proxy", true);

  // Helper to get absolute base URL safely
  const getBaseUrl = (req: express.Request) => {
    // Priority 1: Use APP_URL if provided (AI Studio environment)
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, ""); // Remove trailing slash
    }
    // Priority 2: Fallback to local detection
    const host = req.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  };

  // JSON parsing middleware
  app.use(express.json());

  // OAuth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured" });
    }

    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ].join(" ");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("No code provided");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await response.json();

      // Return a script that sends the tokens to the opener and closes the window
      res.send(`
        <html>
          <body style="background: #111; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', payload: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <div style="text-align: center;">
              <h2>Authentication Successful</h2>
              <p>Closing window...</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Token exchange error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
