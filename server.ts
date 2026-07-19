/**
 * archivim — Deno backend server
 * Accepts dynamic settings from frontend and builds yt-dlp commands accordingly.
 */

const PORT = 8384;
const DEFAULT_DESKTOP = Deno.env.get("USERPROFILE") + "\\OneDrive\\Masa\xFCst\xFC";

interface Settings {
  audioFormat: string;
  audioQuality: string;
  formatSelection: string;
  embedMetadata: boolean;
  embedThumbnail: boolean;
  convertThumbnails: string;
  embedChapters: boolean;
  writeLyrics: boolean;
  ytTemplate: string;
  scTemplate: string;
  outputDir: string;
  restrictFilenames: boolean;
  sponsorblock: boolean;
  splitChapters: boolean;
  cookies: string;
  retries: string;
  sleep: string;
  proxy: string;
  geoBypass: boolean;
}

const DEFAULT_SETTINGS: Settings = {
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

function buildArgs(link: string, isYouTube: boolean, s: Settings): string[] {
  const args: string[] = [];
  const outputDir = s.outputDir && s.outputDir.trim() ? s.outputDir.trim() : DEFAULT_DESKTOP;
  const template = isYouTube ? s.ytTemplate : s.scTemplate;

  args.push("-f", s.formatSelection);
  args.push("-x");
  args.push("--audio-format", s.audioFormat);

  if (s.audioQuality && s.audioQuality !== "0") {
    args.push("--audio-quality", s.audioQuality);
  }
  if (s.embedMetadata) {
    args.push("--embed-metadata");
  }
  if (s.embedThumbnail) {
    args.push("--embed-thumbnail");
  }
  if (s.convertThumbnails) {
    args.push("--convert-thumbnails", s.convertThumbnails);
  }
  if (s.embedChapters) {
    args.push("--embed-chapters");
  }
  if (s.writeLyrics) {
    args.push("--write-subs", "--sub-langs", "all");
  }
  if (s.restrictFilenames) {
    args.push("--restrict-filenames");
  }
  if (s.sponsorblock) {
    args.push("--sponsorblock-remove", "default");
  }
  if (s.splitChapters) {
    args.push("--split-chapters");
  }
  if (s.cookies) {
    args.push("--cookies-from-browser", s.cookies);
  }

  const retries = parseInt(s.retries) || 10;
  args.push("--retries", String(retries));

  const sleep = parseInt(s.sleep) || 0;
  if (sleep > 0) {
    args.push("--sleep-interval", String(sleep));
  }
  if (s.proxy && s.proxy.trim()) {
    args.push("--proxy", s.proxy.trim());
  }
  if (s.geoBypass) {
    args.push("--geo-bypass");
  }
  args.push("--no-colors");
  args.push("--encoding", "utf-8");
  args.push("-o", `${outputDir}\\${template}.%(ext)s`);
  args.push(link);

  return args;
}

Deno.serve({ port: PORT, hostname: "127.0.0.1" }, async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/download" && req.method === "POST") {
    try {
      const body = await req.json();
      const link: string = body.url?.trim();
      const userSettings: Partial<Settings> = body.settings || {};

      if (!link) {
        return json({ error: "URL bo\u015F olamaz." }, 400);
      }

      const isYouTube = link.includes("youtube.com") || link.includes("youtu.be") || link.includes("music.youtube.com");
      const isSoundCloud = link.includes("soundcloud.com");

      if (!isYouTube && !isSoundCloud) {
        return json({ error: "Sadece YouTube / YouTube Music ve SoundCloud linkleri destekleniyor." }, 400);
      }

      const s: Settings = { ...DEFAULT_SETTINGS, ...userSettings };
      const args = buildArgs(link, isYouTube, s);

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (event: string, data: string) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          sendEvent("status", isYouTube ? "YouTube Music'ten indiriliyor..." : "SoundCloud'dan indiriliyor...");
          sendEvent("log", `> yt-dlp ${args.slice(0, -1).join(" ")} "${link}"`);

          try {
            const command = new Deno.Command("yt-dlp", {
              args,
              stdout: "piped",
              stderr: "piped",
              env: {
                "PYTHONIOENCODING": "utf-8",
                "PYTHONUTF8": "1"
              }
            });
            const process = command.spawn();
            
            req.signal.addEventListener("abort", () => {
              try { process.kill("SIGTERM"); } catch {}
            });

            const readStream = async (reader: ReadableStreamDefaultReader<Uint8Array>, _prefix: string) => {
              const decoder = new TextDecoder("utf-8", { fatal: false });
              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
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
                    const alreadyMatch = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/);
                    if (alreadyMatch) sendEvent("filename", alreadyMatch[1].trim());
                  }
                }
              }
              if (buffer.trim()) sendEvent("log", buffer.trim());
            };

            await Promise.all([
              readStream(process.stdout.getReader(), ""),
              readStream(process.stderr.getReader(), ""),
            ]);

            const status = await process.status;
            if (status.success) {
              sendEvent("status", "\u0130ndirme tamamland\u0131! Dosya kaydedildi.");
              sendEvent("done", "success");
            } else {
              sendEvent("status", `\u0130ndirme ba\u015Far\u0131s\u0131z (kod: ${status.code})`);
              sendEvent("done", "error");
            }
          } catch (err) {
            sendEvent("status", `Hata: ${(err as Error).message}`);
            sendEvent("done", "error");
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      return json({ error: "Ge\u00E7ersiz istek." }, 400);
    }
  }

  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = `${Deno.cwd()}${filePath.replaceAll("/", "\\")}`;

  try {
    const file = await Deno.readFile(fullPath);
    const ext = filePath.split(".").pop() || "";
    const contentTypes: Record<string, string> = {
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
    return new Response(file, {
      headers: { "Content-Type": contentTypes[ext] || "application/octet-stream" },
    });
  } catch {
    return new Response("404 Not Found", { status: 404 });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

console.log(`\n  archivim — http://127.0.0.1:${PORT}\n`);
console.log(`  \u0130ndirme klas\u00F6r\u00FC: ${DEFAULT_DESKTOP}\n`);