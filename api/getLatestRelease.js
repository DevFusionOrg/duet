// Vercel Serverless Function: /api/getLatestRelease
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

  try {
    // Returns default release info or pulls from Supabase if env configured
    const defaultRelease = {
      version: process.env.REACT_APP_VERSION || "1.1.9",
      apkUrl: process.env.LATEST_APK_URL || "https://github.com/manulsahu/Duet/releases",
      notes: "Latest stable version.",
    };

    res.status(200).json(defaultRelease);
  } catch (error) {
    console.error("getLatestRelease error:", error);
    res.status(500).json({ error: "Failed to fetch latest release" });
  }
};

