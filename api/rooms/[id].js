export default function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Room ID required" });
  }

  const qs = `id=${encodeURIComponent(id)}`;
  const location = `/api/rooms?${qs}`;

  if (req.method === "GET") {
    return res.writeHead(307, { Location: location }).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return res.status(405).json({ error: "Use /api/rooms?id=" + id + " instead" });
}
