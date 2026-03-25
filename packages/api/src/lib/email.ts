import nodemailer from 'nodemailer';
import { config } from '../config.js';

const hasSmtp = !!config.smtp.user;

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string, attachments?: { filename: string; content: string | Buffer; contentType?: string }[]) {
  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html}\n`);
    if (attachments?.length) console.log(`[DEV EMAIL] Attachments: ${attachments.map((a) => a.filename).join(', ')}`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, html, attachments });
}

export async function sendVerificationEmail(to: string, username: string, token: string) {
  const link = `${config.appUrl}/verify-email?token=${token}`;
  await sendEmail(to, 'Verify your email — crab.ac', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Hey ${username},</h2>
      <p>Welcome to crab.ac! Click the button below to verify your email address.</p>
      <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">Or copy this link: ${link}</p>
      <p style="color:#888;font-size:13px;">This link expires in 24 hours.</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${config.appUrl}/reset-password?token=${token}`;
  await sendEmail(to, 'Reset your password — crab.ac', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">Or copy this link: ${link}</p>
      <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `);
}

export async function sendMagicLinkEmail(to: string, token: string) {
  const link = `${config.appUrl}/auth/magic?token=${token}`;
  await sendEmail(to, 'Your sign-in link — crab.ac', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2>Sign in to crab.ac</h2>
      <p>Click the button below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Sign In</a>
      <p style="margin-top:16px;color:#888;font-size:13px;">Or copy this link: ${link}</p>
      <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `);
}
