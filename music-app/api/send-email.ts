// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer, { TransportOptions } from 'nodemailer';

const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Gmail credentials not configured');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: false,
    logger: true,
    debug: process.env.NODE_ENV === 'development',
  } as TransportOptions);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, text, html } = req.body;

  if (!to || !subject || !text)
    return res.status(400).json({ error: 'Missing required fields: to, subject, text' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to))
    return res.status(400).json({ error: 'Invalid email format' });

  const transporter = createTransporter();
  if (!transporter)
    return res.status(500).json({ error: 'Email service not configured' });

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'HIMIG Music Ministry';
    const fromEmail = process.env.GMAIL_USER!;

    const info = await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to,
      subject,
      text,
      html: html || text,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
      },
    });

    console.log(`✅ Email sent to ${to} | Message ID: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });

  } catch (error: any) {
    console.error('Nodemailer error:', error);

    if (error.code === 'EAUTH')
      return res.status(500).json({ error: 'Authentication failed. Check your Gmail App Password.' });
    if (error.code === 'ECONNECTION')
      return res.status(500).json({ error: 'Could not connect to Gmail SMTP.' });
    if (error.code === 'ESOCKET')
      return res.status(500).json({ error: 'Socket error. Check network connection.' });

    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}