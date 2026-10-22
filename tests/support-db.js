import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
export async function testDatabase(users) {
  const db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  for (const id of users) await db.query('insert into auth.users values ($1)', [id]);
  await db.exec(readFileSync('supabase/migrations/20261022222347_foundation.sql', 'utf8'));
  return db;
}
