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
function addresses(value: string) {
  return value.split(",").map((part) => (part.match(/<([^>]+)>/)?.[1] || part).trim().toLowerCase()).filter((value) => value.includes("@"));
}
function decodeQuotedPrintable(value: string) {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}
function plainBody(headers: string, body: string) {
  const encoding = headerValue(headers, "Content-Transfer-Encoding").toLowerCase();
  let decoded = body;
  if (encoding === "base64") { try { decoded = atob(body.replace(/\s/g, "")); } catch { decoded = body; } }
  else if (encoding === "quoted-printable") decoded = decodeQuotedPrintable(body);
  return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12000);
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function parseRawEmail(raw: string, sourceFileName: string, mailboxAddress: string): Promise<ImportedEmailRecord> {
  const separator = raw.search(/\r?\n\r?\n/);
  const headers = separator >= 0 ? raw.slice(0, separator) : raw;
  const body = separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, "") : "";
  const sender = addresses(headerValue(headers, "From"))[0] || headerValue(headers, "From");
  const recipients = addresses([headerValue(headers, "To"), headerValue(headers, "Cc")].filter(Boolean).join(","));
  const digest = await sha256(raw);
  const parsedDate = new Date(headerValue(headers, "Date"));
  if (Number.isNaN(parsedDate.getTime())) throw new Error(`El mensaje ${sourceFileName} no contiene una fecha válida.`);
  const direction = sender.toLowerCase() === mailboxAddress.trim().toLowerCase() ? "outbound" : "inbound";
  return { messageId: headerValue(headers, "Message-ID").replace(/[<>]/g, "") || `sha256:${digest}`, direction,
    subject: headerValue(headers, "Subject") || "(Sin asunto)", sender, recipients, bodyText: plainBody(headers, body),
    occurredAt: parsedDate.toISOString(), sourceFileName, rawSha256: digest };
}
function splitMbox(raw: string) {
  return raw.split(/\r?\n(?=From .+\r?\n)/).map((part) => part.replace(/^From .+\r?\n/, "")).filter(Boolean);
}
export async function parseEmailFiles(files: File[], mailboxAddress: string) {
  const output: ImportedEmailRecord[] = [];
  for (const file of files) {
    const messages = file.name.toLowerCase().endsWith(".mbox") ? splitMbox(await file.text()) : [await file.text()];
    for (let index = 0; index < messages.length; index += 1) {
      output.push(await parseRawEmail(messages[index], messages.length > 1 ? `${file.name} #${index + 1}` : file.name, mailboxAddress));
      if (output.length > 250) throw new Error("Puede importar un máximo de 250 correos por operación.");
    }
  }
  return output;
}
