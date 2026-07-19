/**
 * archivim — Node.js Backend Server
 * Handles yt-dlp downloads via HTTP API.
 * Serves static assets and provides SSE-based download progress.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const PORT = 8384;
const DEFAULT_DESKTOP = path.join(
  os.homedir(),
  "OneDrive",
  "Masaüstü"
);

// --- Settings Interface ---
const DEFAULT_SETTINGS = {
  audioFormat: "m4a",
  audioQuality: "0",
  formatSelection: "bestaudio[ext=m4a]/bestaudio",
  embedMetadata: true,
  embedThumbnail: true,
  convertThumbnails: "jpg",
  embedChapters: false,
  writeLyrics: false,
  ytTemplate: "%(artist)s - %(title)s",
  scTemplate: "%(uploader)s - %(title)s",
  outputDir: "",
  restrictFilenames: false,
  sponsorblock: false,
  splitChapters: false,
  cookies: "",
  retries: "10",
  sleep: "0",
  proxy: "",
  geoBypass: true,
};

function buildArgs(link, isYouTube, s) {
  const args = [];
  const outputDir =
    s.outputDir && s.outputDir.trim() ? s.outputDir.trim() : DEFAULT_DESKTOP;
  const template = isYouTube ? s.ytTemplate : s.scTemplate;

  args.push("-f", s.formatSelection);
  args.push("-x");
  args.push("--audio-format", s.audioFormat);

  if (s.audioQuality && s.audioQuality !== "0") {
    args.push("--audio-quality", s.audioQuality);
  }
  if (s.embedMetadata) args.push("--embed-metadata");
  if (s.embedThumbnail) args.push("--embed-thumbnail");
  if (s.convertThumbnails) args.push("--convert-thumbnails", s.convertThumbnails);
  if (s.embedChapters) args.push("--embed-chapters");
  if (s.writeLyrics) args.push("--write-subs", "--sub-langs", "all");
  if (s.restrictFilenames) args.push("--restrict-filenames");
  if (s.sponsorblock) args.push("--sponsorblock-remove", "default");
  if (s.splitChapters) args.push("--split-chapters");
  if (s.cookies) args.push("--cookies-from-browser", s.cookies);

  const retries = parseInt(s.retries) || 10;
  args.push("--retries", String(retries));

  const sleep = parseInt(s.sleep) || 0;
  if (sleep > 0) args.push("--sleep-interval", String(sleep));
  if (s.proxy && s.proxy.trim()) args.push("--proxy", s.proxy.trim());
  if (s.geoBypass) args.push("--geo-bypass");
  args.push("--no-colors");
  args.push("--encoding", "utf-8");
  args.push("-o", path.join(outputDir, `${template}.%(ext)s`));
  args.push(link);

  return args;
}

// --- Content Types ---
const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  webmanifest: "application/manifest+json",
};

// --- Active download processes (for cancellation) ---
const activeProcesses = new Map();

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: Shutdown ---
  if (req.method === "POST" && url.pathname === "/api/shutdown") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    // Don't exit the process — Electron handles lifecycle
    return;
  }

  // --- API: Download ---
  if (url.pathname === "/api/download" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const link = parsed.url?.trim();
        const userSettings = parsed.settings || {};

        if (!link) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "URL boş olamaz." }));
          return;
        }

        const isYouTube =
          link.includes("youtube.com") ||
          link.includes("youtu.be") ||
          link.includes("music.youtube.com");
        const isSoundCloud = link.includes("soundcloud.com");

        if (!isYouTube && !isSoundCloud) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "Sadece YouTube / YouTube Music ve SoundCloud linkleri destekleniyor.",
            })
          );
          return;
        }

        const s = { ...DEFAULT_SETTINGS, ...userSettings };
        const args = buildArgs(link, isYouTube, s);

        // SSE response
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const sendEvent = (event, data) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        sendEvent(
          "status",
          isYouTube
            ? "YouTube Music'ten indiriliyor..."
            : "SoundCloud'dan indiriliyor..."
        );
        sendEvent(
          "log",
          `> yt-dlp ${args.slice(0, -1).join(" ")} "${link}"`
        );

        let ytDlpPath = "yt-dlp.exe";
        try {
          ytDlpPath = require("child_process").execSync("where.exe yt-dlp.exe", { encoding: "utf8" }).split("\n")[0].trim();
        } catch (e) {}

        const proc = spawn(ytDlpPath, args, {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
            PYTHONUTF8: "1",
          },
          stdio: ["pipe", "pipe", "pipe"],
        });

        const downloadId = Date.now().toString();
        activeProcesses.set(downloadId, proc);

        req.on("aborted", () => {
          if (activeProcesses.has(downloadId)) {
            try { proc.kill(); } catch {}
            activeProcesses.delete(downloadId);
          }
        });

        const processStream = (stream) => {
          let buffer = "";
          stream.on("data", (chunk) => {
            buffer += chunk.toString("utf-8");
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                sendEvent("log", line.trim());
                const progressMatch = line.match(/(\d+\.\d+)%/);
                if (progressMatch) sendEvent("progress", progressMatch[1]);
                const destMatch = line.match(/Destination:\s*(.+)/);
                if (destMatch) sendEvent("filename", destMatch[1].trim());
                const mergeMatch = line.match(/Merging formats into "(.+)"/);
                if (mergeMatch) sendEvent("filename", mergeMatch[1].trim());
                const alreadyMatch = line.match(
                  /\[download\]\s+(.+?)\s+has already been downloaded/
                );
                if (alreadyMatch)
                  sendEvent("filename", alreadyMatch[1].trim());
              }
            }
          });
          stream.on("end", () => {
            if (buffer.trim()) sendEvent("log", buffer.trim());
          });
        };

        processStream(proc.stdout);
        processStream(proc.stderr);

        let responseEnded = false;

        proc.on("close", (code, signal) => {
          if (responseEnded) return;
          responseEnded = true;
          activeProcesses.delete(downloadId);
          if (code === 0) {
            sendEvent("status", "İndirme tamamlandı! Dosya kaydedildi.");
            sendEvent("done", "success");
          } else {
            sendEvent("status", `İndirme başarısız (kod: ${code}, sinyal: ${signal})`);
            sendEvent("done", "error");
          }
          res.end();
        });

        proc.on("error", (err) => {
          if (responseEnded) return;
          responseEnded = true;
          activeProcesses.delete(downloadId);
          sendEvent("status", `Hata: Uygulama başlatılamadı (${err.message})`);
          sendEvent("done", "error");
          res.end();
        });
      } catch {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Geçersiz istek." }));
      }
    });
    return;
  }

  // --- Static File Serving ---
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  if (filePath === "/favicon.ico") filePath = "/icon.ico";

  const fullPath = path.join(__dirname, filePath);

  try {
    const file = fs.readFileSync(fullPath);
    const ext = path.extname(filePath).slice(1);
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  // Server started silently
});

module.exports = { PORT };
