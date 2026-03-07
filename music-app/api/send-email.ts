// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, text, html, actionUrl } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const sgMail = await import('@sendgrid/mail');
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.error('SENDGRID_API_KEY not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    sgMail.default.setApiKey(apiKey);
    
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'himig@top-ministry.com',
        name: 'HIMIG Music Ministry'
      },
      subject,
      text,
      html: html || text,
      // Add tracking
      trackingSettings: {
        clickTracking: { enable: true, enableText: true },
        openTracking: { enable: true }
      }
    };

    await sgMail.default.send(msg);
    console.log(`Email sent successfully to ${to}`);

    res.status(200).json({ success: true, messageId: 'sent' });
  } catch (error: any) {
    console.error('SendGrid error:', error);
    
    // Handle specific SendGrid errors
    if (error.code === 401) {
      return res.status(500).json({ error: 'Invalid API key' });
    }
    if (error.response?.body?.errors) {
      const errors = error.response.body.errors.map((e: any) => e.message).join(', ');
      return res.status(500).json({ error: errors });
    }
    
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}