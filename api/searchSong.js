// Vercel Serverless Function: /api/searchSong
// Replaces the Firebase Cloud Function with zero cold cost

const normalize = (video) => {
  if (!video) return null;
  const videoId =
    video?.id?.videoId ||
    video?.videoId ||
    video?.id ||
    null;
  const title = video?.snippet?.title || video?.title || null;
  if (!videoId || !title) return null;
  return { videoId, title };
};

const fetchJson = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const searchYouTubeHtml = async (q) => {
  try {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " official audio")}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (!response.ok) return null;
    const html = await response.text();

    const idMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!idMatch) return null;

    const titleRegex = new RegExp(
      `"videoId":"${idMatch[1]}"[\\s\\S]{0,500}?"title":\\{\\"runs\\":\\[\\{\\"text\\":\\"([^\\"]+)\\"`,
      "m"
    );
    const titleMatch = html.match(titleRegex);

    return {
      videoId: idMatch[1],
      title: titleMatch?.[1] || q,
    };
  } catch {
    return null;
  }
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = (req.query?.q || "").toString().trim();
  if (!query) {
    res.status(400).json({ error: "Missing query parameter q" });
    return;
  }

  try {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY || "";

    if (youtubeApiKey) {
      const youtubeData = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
          query + " official audio"
        )}&key=${youtubeApiKey}`
      );
      if (youtubeData?.items?.length) {
        const normalized = normalize(youtubeData.items[0]);
        if (normalized) {
          res.status(200).json(normalized);
          return;
        }
      }
    }

    const lemnosData = await fetchJson(
      `https://yt.lemnoslife.com/noKey/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
        query + " official audio"
      )}`
    );
    if (lemnosData?.items?.length) {
      const normalized = normalize(lemnosData.items[0]);
      if (normalized) {
        res.status(200).json(normalized);
        return;
      }
    }

    const invidiousData = await fetchJson(
      `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query + " official audio")}&type=video`
    );
    if (Array.isArray(invidiousData) && invidiousData.length > 0) {
      const first = invidiousData[0];
      const normalized = normalize({ videoId: first?.videoId, title: first?.title });
      if (normalized) {
        res.status(200).json(normalized);
        return;
      }
    }

    const htmlResult = await searchYouTubeHtml(query);
    if (htmlResult) {
      res.status(200).json(htmlResult);
      return;
    }

    res.status(404).json({ error: "No results found from providers" });
  } catch (error) {
    console.error("searchSong error:", error);
    res.status(500).json({ error: "Search failed" });
  }
};

