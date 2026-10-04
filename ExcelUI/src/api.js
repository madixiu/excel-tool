import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "";

/**
 * Upload a file with progress reporting.
 * @param {File} file - The file to upload
 * @param {(percent: number) => void} [onProgress] - Called with 0–100 as the upload progresses
 */
export function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          reject(new Error("Invalid JSON response from upload"));
        }
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(fd);
  });
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
      const type =
        lines.find((l) => l.startsWith("event:"))?.slice(6).trim() || "message";
      const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
      if (!dataLine) continue;
      try {
        onEvent({ type, data: JSON.parse(dataLine) });
      } catch (err) {
        console.warn("Failed to parse SSE event:", raw);
      }
    }
  }
}