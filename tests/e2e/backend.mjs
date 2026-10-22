// Test-only Supabase transport adapter. Runs the real migration/RPCs in PGlite.
// This is NOT Supabase Auth verification: email delivery and real tokens need staging QA.
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { testDatabase } from '../support-db.js';
const id = '16a9929e-a966-43fe-9a6b-7081c3576a02',
  email = 'teste@financehub.local';
const db = await testDatabase([id]);
const user = {
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
};
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(
  JSON.stringify({
    sub: id,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  }),
).toString('base64url');
const token =
  header +
  '.' +
  payload +
  '.' +
  createHmac('sha256', 'local-test-only')
    .update(header + '.' + payload)
    .digest('base64url');
let queue = Promise.resolve();
createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3100');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/health') {
    res.end('{"ok":true}');
    return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {}
  if (path === '/auth/v1/token') {
    if (body.grant_type !== 'refresh_token' && body.email && body.email !== email) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: 'test-refresh',
        user,
      }),
    );
    return;
  }
  if (path === '/auth/v1/user' && req.headers.authorization === 'Bearer ' + token) {
    res.end(JSON.stringify(user));
    return;
  }
  if (path === '/auth/v1/logout') {
    res.end('{}');
    return;
  }
  if (req.headers.authorization !== 'Bearer ' + token) {
    res.statusCode = 401;
    res.end('{"message":"Unauthorized"}');
    return;
  }
  queue = queue.then(async () => {
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
      let result;
      if (path === '/rest/v1/rpc/finance_snapshot')
        result = (await db.query('select public.finance_snapshot() as value')).rows[0].value;
      else if (path === '/rest/v1/rpc/finance_command')
        result = (
          await db.query('select public.finance_command($1,$2,$3::jsonb,$4::uuid) as value', [
            body.p_action,
            body.p_entity || '',
            JSON.stringify(body.p_data || {}),
            body.p_id || null,
          ])
        ).rows[0].value;
      else {
        res.statusCode = 404;
        result = { message: 'Not found' };
      }
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: error.message, code: error.code || 'P0001' }));
    }
  });
}).listen(54329, '127.0.0.1', () =>
  process.stdout.write('FinanceHub test database transport on 54329\n'),
);
