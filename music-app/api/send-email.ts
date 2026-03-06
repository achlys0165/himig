import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, text, html } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY as string);
    
    await sgMail.default.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'himig@top-ministry.com',
      subject,
      text,
      html: html || text,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('SendGrid error:', error);
    res.status(500).json({ error: error.message });
  }
}