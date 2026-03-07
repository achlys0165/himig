// api/email-action.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { turso } from '../src/lib/turso';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request (user clicks from email)
  if (req.method === 'GET') {
    const { scheduleId, action, token } = req.query;

    if (!scheduleId || !action || !token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - Invalid Request</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; max-width: 400px; }
            .error { color: #ff4444; font-size: 48px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">✕</div>
            <h1>Invalid Link</h1>
            <p>This link appears to be invalid or has expired. Please log in to HIMIG to manage your assignments.</p>
            <a href="https://top-himig.vercel.app" class="btn">Go to HIMIG</a>
          </div>
        </body>
        </html>
      `);
    }

    try {
      // Verify the token matches the schedule
      const { rows } = await turso.execute({
        sql: 'SELECT s.*, u.name, u.email FROM schedules s JOIN users u ON s.musician_id = u.id WHERE s.id = ?',
        args: [scheduleId]
      });

      if (rows.length === 0) {
        throw new Error('Assignment not found');
      }

      const schedule = rows[0] as any;
      
      // Simple token verification (schedule ID + musician ID + date)
      const expectedToken = Buffer.from(`${scheduleId}:${schedule.musician_id}:${schedule.date}`).toString('base64');
      if (token !== expectedToken) {
        throw new Error('Invalid token');
      }

      // Check if already responded
      if (schedule.status !== 'pending') {
        const status = schedule.status === 'accepted' ? 'accepted' : 'declined';
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>HIMIG - Already Responded</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
              .container { text-align: center; padding: 40px; max-width: 400px; }
              .icon { font-size: 48px; margin-bottom: 20px; }
              h1 { font-size: 24px; margin-bottom: 10px; }
              p { color: #666; line-height: 1.6; }
              .details { background: #111; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; }
              .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
              .value { color: #fff; font-weight: bold; margin-bottom: 12px; }
              .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">✓</div>
              <h1>Already Responded</h1>
              <p>You have already ${status} this assignment.</p>
              <div class="details">
                <div class="label">Role</div>
                <div class="value">${schedule.role}</div>
                <div class="label">Date</div>
                <div class="value">${schedule.date}</div>
                <div class="label">Status</div>
                <div class="value" style="color: ${schedule.status === 'accepted' ? '#4ade80' : '#f87171'}">${schedule.status.toUpperCase()}</div>
              </div>
              <a href="https://top-himig.vercel.app/schedule" class="btn">View My Schedule</a>
            </div>
          </body>
          </html>
        `);
      }

      // Show confirmation page
      const isAccept = action === 'accept';
      const actionColor = isAccept ? '#4ade80' : '#f87171';
      const actionIcon = isAccept ? '✓' : '✕';
      const actionText = isAccept ? 'Accept' : 'Decline';

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - ${actionText} Assignment</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; max-width: 400px; }
            .icon { color: ${actionColor}; font-size: 48px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .details { background: #111; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; border: 1px solid #222; }
            .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { color: #fff; font-weight: bold; margin-bottom: 12px; }
            .btn-group { display: flex; gap: 12px; margin-top: 20px; }
            .btn { flex: 1; padding: 14px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; }
            .btn-primary { background: ${actionColor}; color: #000; }
            .btn-secondary { background: transparent; color: #fff; border: 1px solid #333; }
            .reason-box { margin-top: 15px; }
            textarea { width: 100%; background: #000; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; font-family: inherit; resize: vertical; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${actionIcon}</div>
            <h1>${actionText} Assignment?</h1>
            <p>Please confirm your response to this service assignment:</p>
            <div class="details">
              <div class="label">Musician</div>
              <div class="value">${schedule.name}</div>
              <div class="label">Role</div>
              <div class="value">${schedule.role}</div>
              <div class="label">Date</div>
              <div class="value">${new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <form method="POST" action="/api/email-action">
              <input type="hidden" name="scheduleId" value="${scheduleId}">
              <input type="hidden" name="action" value="${action}">
              <input type="hidden" name="token" value="${token}">
              
              ${!isAccept ? `
              <div class="reason-box">
                <div class="label">Reason for declining (optional)</div>
                <textarea name="declineReason" rows="3" placeholder="e.g., I have a family event, I'm out of town..."></textarea>
              </div>
              ` : ''}
              
              <div class="btn-group">
                <a href="https://top-himig.vercel.app" class="btn btn-secondary">Cancel</a>
                <button type="submit" class="btn btn-primary">Confirm ${actionText}</button>
              </div>
            </form>
          </div>
        </body>
        </html>
      `);

    } catch (error: any) {
      console.error('Email action GET error:', error);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; max-width: 400px; }
            .error { color: #ff4444; font-size: 48px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">⚠</div>
            <h1>Link Expired</h1>
            <p>This link has expired or is no longer valid. Please log in to HIMIG to manage your assignments.</p>
            <a href="https://top-himig.vercel.app" class="btn">Go to HIMIG</a>
          </div>
        </body>
        </html>
      `);
    }
  }

  // Handle POST request (form submission)
  if (req.method === 'POST') {
    const { scheduleId, action, token, declineReason } = req.body;

    try {
      // Verify token again
      const { rows } = await turso.execute({
        sql: 'SELECT s.*, u.name, u.email FROM schedules s JOIN users u ON s.musician_id = u.id WHERE s.id = ?',
        args: [scheduleId]
      });

      if (rows.length === 0) {
        throw new Error('Assignment not found');
      }

      const schedule = rows[0] as any;
      const expectedToken = Buffer.from(`${scheduleId}:${schedule.musician_id}:${schedule.date}`).toString('base64');
      
      if (token !== expectedToken) {
        throw new Error('Invalid token');
      }

      // Update schedule status
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      await turso.execute({
        sql: 'UPDATE schedules SET status = ?, decline_reason = ? WHERE id = ?',
        args: [newStatus, declineReason || null, scheduleId]
      });

      // Notify admins
      const { rows: admins } = await turso.execute({
        sql: "SELECT id, email, name FROM users WHERE role IN ('admin', 'super_admin')"
      });

      const actionText = action === 'accept' ? 'accepted' : 'declined';
      const adminMessage = `${schedule.name} has ${actionText} the assignment for ${schedule.role} on ${schedule.date}${declineReason ? `. Reason: ${declineReason}` : ''}`;

      // Send notifications to admins (async, don't wait)
      for (const admin of admins) {
        const adminData = admin as any;
        await turso.execute({
          sql: `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            'notif-' + Date.now() + '-' + adminData.id,
            adminData.id,
            adminMessage,
            'info',
            false
          ]
        });
      }

      // Return success page
      const successColor = action === 'accept' ? '#4ade80' : '#f87171';
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - Response Recorded</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; max-width: 400px; }
            .icon { color: ${successColor}; font-size: 64px; margin-bottom: 20px; animation: scaleIn 0.3s ease; }
            @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
            h1 { font-size: 28px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .details { background: #111; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; border: 1px solid #222; }
            .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { color: #fff; font-weight: bold; margin-bottom: 12px; }
            .status { display: inline-block; padding: 6px 12px; background: ${successColor}20; color: ${successColor}; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .btn { display: inline-block; margin-top: 20px; padding: 14px 28px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Response Recorded!</h1>
            <p>Your response has been saved successfully.</p>
            <div class="details">
              <div class="label">Assignment</div>
              <div class="value">${schedule.role}</div>
              <div class="label">Date</div>
              <div class="value">${new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div class="label">Status</div>
              <div><span class="status">${newStatus}</span></div>
            </div>
            <a href="https://top-himig.vercel.app/schedule" class="btn">View My Schedule</a>
          </div>
        </body>
        </html>
      `);

    } catch (error: any) {
      console.error('Email action POST error:', error);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 40px; max-width: 400px; }
            .error { color: #ff4444; font-size: 48px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">⚠</div>
            <h1>Unable to Process</h1>
            <p>We couldn't process your response. The assignment may have been updated or removed.</p>
            <a href="https://top-himig.vercel.app" class="btn">Go to HIMIG</a>
          </div>
        </body>
        </html>
      `);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}