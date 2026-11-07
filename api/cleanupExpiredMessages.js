// Vercel Serverless Function: /api/cleanupExpiredMessages
// Can be triggered by Vercel Cron or an external ping (e.g. cron-job.org)

const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Missing Supabase credentials in environment" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("messages")
      .delete()
      .lte("deletion_time", now)
      .eq("is_saved", false)
      .select("id");

    if (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({
      success: true,
      deletedCount: data?.length || 0,
      timestamp: now,
    });
  } catch (err) {
    console.error("Cleanup handler exception:", err);
    res.status(500).json({ error: err.message });
  }
};

