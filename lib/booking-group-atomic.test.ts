import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
const db=new PGlite();
beforeAll(async()=>{
 await db.exec(`create table properties(id text primary key,code text);
 insert into properties values('p1','QA');
 create table bookings(id uuid primary key default gen_random_uuid(),property_id text,room_id text,
 code text,check_in date,check_out date,status text default 'confirmed',unique(property_id,code));`);
 const migration=readFileSync(new URL('../supabase/migrations/05_pms_tables.sql',import.meta.url),'utf8');
 await db.exec(migration.slice(migration.indexOf('create or replace function public.assert_no_room_conflict()'),migration.indexOf('-- RLS')));
},30000);
afterAll(()=>db.close());
it('bulk insert generates distinct booking codes and rolls back every new room if one conflicts',async()=>{
 await db.exec(`insert into bookings(property_id,room_id,check_in,check_out) values
 ('p1','r1','2026-09-27','2026-09-29'),('p1','r2','2026-09-27','2026-09-29');`);
 expect((await db.query('select code from bookings order by code')).rows).toEqual([{code:'BK-QA-0001'},{code:'BK-QA-0002'}]);
 await expect(db.exec(`insert into bookings(property_id,room_id,check_in,check_out) values
 ('p1','r3','2026-09-27','2026-09-29'),('p1','r1','2026-09-27','2026-09-29');`)).rejects.toThrow('HG-BOOK-409');
 expect((await db.query('select room_id from bookings order by room_id')).rows).toEqual([{room_id:'r1'},{room_id:'r2'}]);
});
