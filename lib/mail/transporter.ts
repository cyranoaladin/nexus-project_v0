import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST || "localhost",
  port: Number(process.env.EMAIL_SERVER_PORT || 1025),
  secure: false,
  auth: process.env.EMAIL_SERVER_USER
    ? {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      }
    : undefined,
});

export async function sendBilanEmail(to: string, subject: string, html: string, pdf?: Buffer) {
  const from = process.env.EMAIL_FROM || "Nexus Réussite <no-reply@nexus.local>";
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments: pdf
      ? [
          {
            filename: "bilan.pdf",
            content: pdf,
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}

