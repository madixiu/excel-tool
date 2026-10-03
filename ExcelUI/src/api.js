import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await axios.post(`${BASE}/api/upload`, fd);
  return data; // { token, filename }
}

export async function inspectFile(token) {
  const fd = new FormData();
  fd.append("token", token);
  const { data } = await axios.post(`${BASE}/api/inspect`, fd);
  return data; // { rows, columns, column_map }
}

export function downloadUrl(token) {
  return `${BASE}/api/download/${token}`;
}

/**
 * Streams SSE events from /api/process.
 * Calls onEvent({ type, data }) for each event.
 * Returns a promise that resolves when the stream ends.
 */
export async function processFile({ token, payload, onEvent }) {
  const fd = new FormData();
  fd.append("token", token);
  fd.append("payload", JSON.stringify(payload));

  const res = await fetch(`${BASE}/api/process`, { method: "POST", body: fd });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by "\n\n"
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = raw.split("\n");
      const type = lines.find(l => l.startsWith("event:"))?.slice(6).trim() || "message";
      const dataLine = lines.find(l => l.startsWith("data:"))?.slice(5).trim();
      if (!dataLine) continue;
      onEvent({ type, data: JSON.parse(dataLine) });
    }
  }
}