import { connect } from "node:tls";

type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
};

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

export async function sendSmtpMail(options: SmtpOptions) {
  return new Promise<{ messageId: string }>((resolve, reject) => {
    const socket = connect({ host: options.host, port: options.port, servername: options.host });
    let buffer = "";
    let step = 0;
    const messageId = `<${crypto.randomUUID()}@jlgcargo.com>`;
    const commands = [
      `EHLO jlg-cargo-net.vercel.app`,
      `AUTH LOGIN`,
      Buffer.from(options.user).toString("base64"),
      Buffer.from(options.password).toString("base64"),
      `MAIL FROM:<${options.from}>`,
      `RCPT TO:<${options.to}>`,
      "DATA",
      [
        `From: JLG Cargo SRL <${options.from}>`,
        `To: ${options.to}`,
        `Subject: ${encodeHeader(options.subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${messageId}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        dotStuff(options.text),
        ".",
      ].join("\r\n"),
      "QUIT",
    ];

    const fail = (reason: unknown) => {
      socket.destroy();
      reject(reason instanceof Error ? reason : new Error(String(reason)));
    };
    socket.setTimeout(20_000, () => fail(new Error("El servidor de correo no respondió a tiempo.")));
    socket.on("error", fail);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!/^\d{3}[ -]/.test(line) || /^\d{3}-/.test(line)) continue;
        const code = Number(line.slice(0, 3));
        if (code >= 400) return fail(new Error(`El servidor de correo rechazó el envío (${code}).`));
        if (step < commands.length) socket.write(`${commands[step++]}\r\n`);
        else {
          socket.end();
          resolve({ messageId });
        }
      }
    });
  });
}
