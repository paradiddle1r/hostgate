import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Actual PostgreSQL trigger execution with two tenant identities and RLS.
// Minimal schema fixture isolates migration 28; production migrations are not run.
const db = new PGlite();
const migration = readFileSync(new URL("../supabase/migrations/28_rental_booking_type.sql", import.meta.url), "utf8");
beforeAll(async () => {
  await db.exec(`
    create role rental_test_user;
    create table bookings (id text primary key, tenant_id text, property_id text,
      booking_type text not null default 'standard', status text not null default 'confirmed');
    create table rental_tenants (booking_id text unique references bookings(id), tenant_id text,
      property_id text, monthly_rent numeric not null check(monthly_rent >= 0));
    alter table bookings enable row level security;
    alter table rental_tenants enable row level security;
    create policy booking_tenant on bookings for all to rental_test_user
      using (tenant_id = current_setting('test.tenant')) with check (tenant_id = current_setting('test.tenant'));
    create policy rental_tenant on rental_tenants for all to rental_test_user
      using (tenant_id = current_setting('test.tenant')) with check (tenant_id = current_setting('test.tenant'));
    grant usage on schema public to rental_test_user;
    grant select, insert, update on bookings, rental_tenants to rental_test_user;
  `);
  await db.exec(migration);
  await db.exec(migration); // safe to reapply
}, 30000);
afterAll(async () => db.close());
beforeEach(async () => {
  await db.exec(`reset role; truncate rental_tenants, bookings;
    insert into bookings(id,tenant_id,property_id) values ('a','tenant-a','property-a'), ('b','tenant-b','property-b');
    set role rental_test_user; set test.tenant = 'tenant-a';`);
});
const save = (id = "a", tenant = "tenant-a", property = "property-a", rent = 6000) => db.query(
  `insert into rental_tenants(booking_id,tenant_id,property_id,monthly_rent) values ($1,$2,$3,$4)
    on conflict(booking_id) do update set monthly_rent = excluded.monthly_rent returning *`, [id, tenant, property, rent]);
const bookingType = async () => (await db.query<{ booking_type: string }>("select booking_type from bookings where id='a'")).rows[0].booking_type;

describe("monthly conversion transaction", () => {
  it("converts daily booking and saves configuration atomically, including repeated upserts", async () => {
    await save(); expect(await bookingType()).toBe("monthly");
    await save("a", "tenant-a", "property-a", 7000);
    expect((await db.query("select monthly_rent from rental_tenants")).rows).toEqual([{monthly_rent: "7000"}]);
  });
  it("rolls conversion back if the config write fails after the trigger", async () => {
    await expect(save("a", "tenant-a", "property-a", -1)).rejects.toThrow();
    expect(await bookingType()).toBe("standard");
    expect((await db.query("select * from rental_tenants")).rows).toHaveLength(0);
  });
  it.each(["blocked", "oos"])("rejects %s inventory without converting it", async (type) => {
    await db.query("update bookings set booking_type=$1 where id='a'", [type]);
    await expect(save()).rejects.toThrow("HG-BOOK-422");
    expect(await bookingType()).toBe(type);
  });
  it.each(["cancelled", "checked_out"])("rejects a new rental for a %s booking", async (status) => {
    await db.query("update bookings set status=$1 where id='a'", [status]);
    await expect(save()).rejects.toThrow("HG-BOOK-422");
    expect(await bookingType()).toBe("standard");
  });
  it("allows bookkeeping on an existing monthly contract after checkout", async () => {
    await save(); await db.exec("update bookings set status='checked_out' where id='a'");
    await save("a", "tenant-a", "property-a", 6500);
    expect(await bookingType()).toBe("monthly");
  });
  it("rejects a different property even in the same tenant", async () => {
    await expect(save("a", "tenant-a", "wrong-property")).rejects.toThrow("HG-BOOK-404");
    expect(await bookingType()).toBe("standard");
  });
  it("cannot read or convert the other tenant's booking", async () => {
    await expect(save("b", "tenant-b", "property-b")).rejects.toThrow("HG-BOOK-404");
    await db.exec("set test.tenant='tenant-b'");
    expect((await db.query("select booking_type from bookings where id='b'")).rows).toEqual([{booking_type: "standard"}]);
    await save("b", "tenant-b", "property-b");
    expect((await db.query("select booking_type from bookings where id='b'")).rows).toEqual([{booking_type: "monthly"}]);
  });
  it("does not backfill existing legacy data when installed", async () => {
    await db.exec("reset role; drop trigger rental_tenants_booking_type on rental_tenants");
    await save(); await db.exec(migration);
    expect(await bookingType()).toBe("standard");
    await db.exec("set role rental_test_user");
    await save(); expect(await bookingType()).toBe("monthly");
  });
});
