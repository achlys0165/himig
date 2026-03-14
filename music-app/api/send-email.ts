// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Create reusable transporter using Gmail SMTP
const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Gmail credentials not configured');
    return null;
  }

  // Gmail SMTP configuration
  // Using port 465 with secure: true for SSL connection
  // This is more reliable on Vercel than STARTTLS on port 587
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: user,
      pass: pass, // This is the 16-character App Password, not your Gmail password
    },
    // Important for Vercel serverless functions
    pool: false, // Don't use pooling in serverless
    logger: true,
    debug: process.env.NODE_ENV === 'development',
  } as nodemailer.TransportOptions);
};


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

  const { to, subject, text, html } = req.body;

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const transporter = createTransporter();
  
  if (!transporter) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'HIMIG Music Ministry';
    const fromEmail = process.env.GMAIL_USER;

    if (!fromEmail) {
      return res.status(500).json({ error: 'Sender email not configured' });
    }

    const mailOptions = {
      from: {
        name: fromName,
        address: fromEmail,
      },
      to,
      subject,
      text,
      html: html || text,
      // Add headers to improve deliverability
      headers: {
        'X-Priority': '1', // High priority
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
      },
    };

    // Send mail with defined transport object
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully to ${to}`);
    console.log('Message ID:', info.messageId);

    res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    });
    
  } catch (error: any) {
    console.error('Nodemailer error:', error);
    
    // Handle specific Gmail/Nodemailer errors
    if (error.code === 'EAUTH') {
      return res.status(500).json({ 
        error: 'Authentication failed. Check your Gmail App Password.' 
      });
    }
    
    if (error.code === 'ECONNECTION') {
      return res.status(500).json({ 
        error: 'Could not connect to Gmail SMTP server.' 
      });
    }
    
    if (error.code === 'ESOCKET') {
      return res.status(500).json({ 
        error: 'Socket error. Check your network connection.' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to send email' 
    });
  }
}