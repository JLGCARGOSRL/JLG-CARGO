export interface ImportedEmailRecord {
  messageId: string;
  direction: "inbound" | "outbound";
  subject: string;
  sender: string;
  recipients: string[];
  bodyText: string;
  occurredAt: string;
  sourceFileName: string;
  rawSha256: string;
}

function unfoldHeaders(raw: string) { return raw.replace(/\r?\n[ \t]+/g, " "); }
function headerValue(headers: string, name: string) {
  return unfoldHeaders(headers).match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1]?.trim() || "";
}
function textDecoder(charset = "utf-8") {
  try { return new TextDecoder(charset.replace(/["']/g, "").trim()); }
  catch { return new TextDecoder("utf-8"); }
}
function base64Bytes(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function quotedPrintableBytes(value: string, headerMode = false) {
  const normalized = value.replace(/=\r?\n/g, "").replace(headerMode ? /_/g : /$^/, " ");
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const hex = normalized.slice(index + 1, index + 3);
    if (normalized[index] === "=" && /^[0-9A-F]{2}$/i.test(hex)) { bytes.push(Number.parseInt(hex, 16)); index += 2; }
    else {
      const encoded = new TextEncoder().encode(normalized[index]);
      bytes.push(...encoded);
    }
  }
  return new Uint8Array(bytes);
}
function decodeHeader(value: string) {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi, (_, charset, encoding, content) => {
    try {
      const bytes = encoding.toLowerCase() === "b" ? base64Bytes(content) : quotedPrintableBytes(content, true);
      return textDecoder(charset).decode(bytes);
    } catch { return content; }
  }).replace(/\s{2,}/g, " ").trim();
}
function addresses(value: string) {
  return value.split(",").map((part) => (part.match(/<([^>]+)>/)?.[1] || part).trim().toLowerCase()).filter((item) => item.includes("@"));
}
function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return named[entity.toLowerCase()] || `&${entity};`;
  });
}
function cleanText(value: string, html = false) {
  const text = html ? value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>|<\/div>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, " ") : value;
  return decodeEntities(text).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
}
function splitEntity(raw: string) {
  const separator = raw.search(/\r?\n\r?\n/);
  return { headers: separator >= 0 ? raw.slice(0, separator) : raw, body: separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, "") : "" };
}
function decodePart(headers: string, body: string) {
  const contentType = headerValue(headers, "Content-Type") || "text/plain; charset=utf-8";
  const charset = contentType.match(/charset\s*=\s*"?([^;"\s]+)/i)?.[1] || "utf-8";
  const encoding = headerValue(headers, "Content-Transfer-Encoding").toLowerCase();
  try {
    if (encoding === "base64") return textDecoder(charset).decode(base64Bytes(body));
    if (encoding === "quoted-printable") return textDecoder(charset).decode(quotedPrintableBytes(body));
  } catch { return body; }
  return body;
}
function extractBody(headers: string, body: string): string {
  const contentType = headerValue(headers, "Content-Type").toLowerCase();
  const boundary = headerValue(headers, "Content-Type").match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
  if (contentType.startsWith("multipart/") && boundary) {
    const parts = body.split(`--${boundary}`).slice(1).map((part) => part.replace(/^\r?\n/, "").replace(/\r?\n--\s*$/, "")).filter((part) => part.trim() && part.trim() !== "--");
    const decoded = parts.map((part) => {
      const entity = splitEntity(part);
      const type = headerValue(entity.headers, "Content-Type").toLowerCase();
      const disposition = headerValue(entity.headers, "Content-Disposition").toLowerCase();
      if (disposition.startsWith("attachment")) return { type, text: "" };
      return { type, text: extractBody(entity.headers, entity.body) };
    });
    return decoded.find((part) => part.type.startsWith("text/plain") && part.text)?.text
      || decoded.find((part) => part.type.startsWith("text/html") && part.text)?.text
      || decoded.find((part) => part.text)?.text || "";
  }
  return cleanText(decodePart(headers, body), contentType.startsWith("text/html"));
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function parseRawEmail(raw: string, sourceFileName: string, mailboxAddress: string): Promise<ImportedEmailRecord> {
  const { headers, body } = splitEntity(raw);
  const sender = addresses(headerValue(headers, "From"))[0] || decodeHeader(headerValue(headers, "From"));
  const recipients = addresses([headerValue(headers, "To"), headerValue(headers, "Cc")].filter(Boolean).join(","));
  const digest = await sha256(raw);
  const parsedDate = new Date(headerValue(headers, "Date"));
  if (Number.isNaN(parsedDate.getTime())) throw new Error(`El mensaje ${sourceFileName} no contiene una fecha válida.`);
  const direction = sender.toLowerCase() === mailboxAddress.trim().toLowerCase() ? "outbound" : "inbound";
  return { messageId: headerValue(headers, "Message-ID").replace(/[<>]/g, "") || `sha256:${digest}`, direction,
    subject: decodeHeader(headerValue(headers, "Subject")) || "(Sin asunto)", sender, recipients, bodyText: extractBody(headers, body),
    occurredAt: parsedDate.toISOString(), sourceFileName, rawSha256: digest };
}
function splitMbox(raw: string) {
  return raw.split(/\r?\n(?=From \S+ .+\d{4}\r?\n)/).map((part) => part.replace(/^From .+\r?\n/, "")).filter(Boolean);
}
export async function parseEmailFiles(files: File[], mailboxAddress: string) {
  const output: ImportedEmailRecord[] = [];
  for (const file of files) {
    const raw = await file.text();
    const messages = file.name.toLowerCase().endsWith(".mbox") ? splitMbox(raw) : [raw];
    for (let index = 0; index < messages.length; index += 1) {
      output.push(await parseRawEmail(messages[index], messages.length > 1 ? `${file.name} #${index + 1}` : file.name, mailboxAddress));
      if (output.length > 250) throw new Error("Puede importar un máximo de 250 correos por operación.");
    }
  }
  return output;
}
