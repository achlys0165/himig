// api/email-action.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const encodeToken = (data: string): string => Buffer.from(data).toString('base64');

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN   = process.env.TURSO_AUTH_TOKEN;

// Vercel doesn't auto-parse application/x-www-form-urlencoded (HTML form POST)
async function parseFormBody(req: VercelRequest): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      const parsed: Record<string, string> = {};
      new URLSearchParams(body).forEach((value, key) => { parsed[key] = value; });
      resolve(parsed);
    });
    req.on('error', reject);
  });
}

// Turso HTTP API returns rows as arrays of {type,value} cells with cols separate.
// This helper zips them into plain objects AND wraps args correctly.
async function tursoExecute(sql: string, args: any[] = []) {
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    throw new Error('Database not configured');
  }

  const wrappedArgs = args.map((arg) => {
    if (arg === null || arg === undefined) return { type: 'null',    value: null };
    if (typeof arg === 'number')           return { type: 'integer', value: String(arg) };
    return { type: 'text', value: String(arg) };
  });

  const response = await fetch(
    TURSO_DATABASE_URL.replace('libsql://', 'https://') + '/v2/pipeline',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURSO_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args: wrappedArgs } },
          { type: 'close' },
        ],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Database error ${response.status}: ${text}`);
  }

  const data   = await response.json();
  const result = data.results[0]?.result;
  if (!result) return { rows: [] };

  const cols: string[] = result.cols.map((c: any) => c.name);
  const rows = result.rows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    row.forEach((cell: any, i: number) => { obj[cols[i]] = cell?.value ?? null; });
    return obj;
  });

  return { rows };
}

// ── Shared query: fetch schedule + musician with NO column collisions ────────
// s.* and u.* both have "id" — alias everything explicitly to avoid overwrites.
const SCHEDULE_QUERY = `
  SELECT
    s.id            AS schedule_id,
    s.musician_id,
    s.date,
    s.role,
    s.status,
    s.decline_reason,
    u.name          AS musician_name,
    u.email         AS musician_email
  FROM schedules s
  JOIN users u ON s.musician_id = u.id
  WHERE s.id = ?
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const errorPage = (title: string, message: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HIMIG - ${title}</title>
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
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="https://top-himig.vercel.app" class="btn">Go to HIMIG</a>
      </div>
    </body>
    </html>
  `;

  // ── GET: Show confirmation page ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const scheduleId = Array.isArray(req.query.scheduleId) ? req.query.scheduleId[0] : req.query.scheduleId;
      const action     = Array.isArray(req.query.action)     ? req.query.action[0]     : req.query.action;
      const token      = Array.isArray(req.query.token)      ? req.query.token[0]      : req.query.token;

      if (!scheduleId || !action || !token) {
        return res.status(400).send(errorPage('Invalid Link', 'This link is missing required parameters.'));
      }

      const { rows } = await tursoExecute(SCHEDULE_QUERY, [scheduleId]);

      if (rows.length === 0) {
        return res.status(404).send(errorPage('Not Found', 'This assignment no longer exists.'));
      }

      const s = rows[0];

      // Verify token — must match what DataContext generated: btoa(`${scheduleId}:${musician_id}:${date}`)
      const expectedToken = encodeToken(`${scheduleId}:${s.musician_id}:${s.date}`);
      const decodedToken  = decodeURIComponent(token);
      if (decodedToken !== expectedToken && token !== expectedToken) {
        return res.status(403).send(errorPage('Invalid Token', 'This link has expired or is invalid.'));
      }

      // Already responded
      if (s.status !== 'pending') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>HIMIG - Already Responded</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
              .container { text-align: center; padding: 40px; max-width: 400px; }
              .icon { font-size: 48px; margin-bottom: 20px; color: ${s.status === 'accepted' ? '#22c55e' : '#ef4444'}; }
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
              <p>You have already <strong>${s.status}</strong> this assignment.</p>
              <div class="details">
                <div class="label">Role</div><div class="value">${s.role}</div>
                <div class="label">Date</div><div class="value">${s.date}</div>
                <div class="label">Status</div>
                <div class="value" style="color: ${s.status === 'accepted' ? '#22c55e' : '#ef4444'}">${s.status?.toUpperCase()}</div>
              </div>
              <a href="https://top-himig.vercel.app/schedule" class="btn">View My Schedule</a>
            </div>
          </body>
          </html>
        `);
      }

      // Show confirm page
      const isAccept    = action === 'accept';
      const actionColor = isAccept ? '#22c55e' : '#ef4444';
      const actionIcon  = isAccept ? '&#10003;' : '&#10005;';
      const actionText  = isAccept ? 'Accept' : 'Decline';

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HIMIG - ${actionText} Assignment</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .container { text-align: center; max-width: 400px; width: 100%; }
            .icon { color: ${actionColor}; font-size: 48px; margin-bottom: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; line-height: 1.6; }
            .details { background: #111; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left; border: 1px solid #222; }
            .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { color: #fff; font-weight: bold; margin-bottom: 12px; }
            .btn-group { display: flex; gap: 12px; margin-top: 20px; }
            .btn { flex: 1; padding: 14px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; font-size: 14px; }
            .btn-primary { background: ${actionColor}; color: #fff; }
            .btn-secondary { background: transparent; color: #fff; border: 1px solid #333; }
            .reason-box { margin-top: 15px; text-align: left; }
            .reason-label { color: #666; font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 8px; }
            textarea { width: 100%; background: #000; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 8px; font-family: inherit; resize: vertical; box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${actionIcon}</div>
            <h1>${actionText} Assignment?</h1>
            <p>Please confirm your response:</p>
            <div class="details">
              <div class="label">Musician</div><div class="value">${s.musician_name}</div>
              <div class="label">Role</div><div class="value">${s.role}</div>
              <div class="label">Date</div>
              <div class="value">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <form method="POST" action="/api/email-action">
              <input type="hidden" name="scheduleId" value="${scheduleId}">
              <input type="hidden" name="action"     value="${action}">
              <input type="hidden" name="token"      value="${token}">
              ${!isAccept ? `
              <div class="reason-box">
                <span class="reason-label">Reason for declining (optional)</span>
                <textarea name="declineReason" rows="3" placeholder="e.g., I have a family event, I'm out of town..."></textarea>
              </div>` : ''}
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
      return res.status(500).send(errorPage('Server Error', 'Something went wrong. Please try again or log in to HIMIG.'));
    }
  }

  // ── POST: Process the confirmation ──────────────────────────────────────
  if (req.method === 'POST') {
    try {
      // req.body may be undefined for HTML form POSTs on Vercel — parse manually if needed
      const formData = (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0)
        ? req.body
        : await parseFormBody(req);

      const { scheduleId, action, token, declineReason } = formData;

      if (!scheduleId || !action || !token) {
        return res.status(400).send(errorPage('Invalid Request', 'Missing required fields.'));
      }

      const { rows } = await tursoExecute(SCHEDULE_QUERY, [scheduleId]);

      if (rows.length === 0) {
        return res.status(404).send(errorPage('Not Found', 'Assignment not found.'));
      }

      const s = rows[0];
      const expectedToken = encodeToken(`${scheduleId}:${s.musician_id}:${s.date}`);
      const decodedToken  = decodeURIComponent(token);

      if (decodedToken !== expectedToken && token !== expectedToken) {
        return res.status(403).send(errorPage('Invalid Token', 'Token verification failed.'));
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      await tursoExecute(
        'UPDATE schedules SET status = ?, decline_reason = ? WHERE id = ?',
        [newStatus, declineReason || null, scheduleId]
      );

      // Notify admins
      const { rows: admins } = await tursoExecute(
        "SELECT id FROM users WHERE role IN ('admin', 'super_admin')"
      );

      const adminMessage = `${s.musician_name} has ${newStatus} the assignment for ${s.role} on ${s.date}${declineReason ? `. Reason: ${declineReason}` : ''}`;

      for (const admin of admins) {
        await tursoExecute(
          `INSERT INTO notifications (id, user_id, message, type, read, created_at) 
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          ['notif-' + Date.now() + '-' + admin.id, admin.id, adminMessage, 'info', false]
        );
      }

      const successColor = action === 'accept' ? '#22c55e' : '#ef4444';

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
            .status-badge { display: inline-block; padding: 6px 12px; background: ${successColor}20; color: ${successColor}; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .btn { display: inline-block; margin-top: 20px; padding: 14px 28px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">&#10003;</div>
            <h1>Response Recorded!</h1>
            <p>Your response has been saved successfully.</p>
            <div class="details">
              <div class="label">Assignment</div><div class="value">${s.role}</div>
              <div class="label">Date</div>
              <div class="value">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div class="label">Status</div>
              <div><span class="status-badge">${newStatus}</span></div>
            </div>
            <a href="https://top-himig.vercel.app/schedule" class="btn">View My Schedule</a>
          </div>
        </body>
        </html>
      `);

    } catch (error: any) {
      console.error('Email action POST error:', error);
      return res.status(500).send(errorPage('Server Error', 'Failed to process your response. Please try again.'));
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}