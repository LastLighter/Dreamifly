# Database Migration Guide

## Quick Start

Run this command to apply the authentication database schema:

```bash
npx drizzle-kit push
```

## What This Does

This command will create the following tables in your PostgreSQL database:

1. **user** - Stores user accounts
2. **session** - Manages active sessions
3. **account** - Stores authentication credentials
4. **verification** - Handles email verification and password resets

## Before Running

Make sure your `.env` file has the correct database connection:

```env
DATABASE_URL=postgresql://username:password@host:port/database
```

## Step-by-Step

### Option 1: Using Drizzle Kit (Recommended)

```bash
# Push schema directly to database
npx drizzle-kit push
```

This will:
- Connect to your database
- Compare current schema with your code
- Apply necessary changes
- Create all auth tables

### Option 2: Using Better Auth CLI

```bash
# Generate and apply migration
npx @better-auth/cli migrate
```

### Option 3: Generate SQL Migration File

If you prefer to review the SQL before applying:

```bash
# Generate migration file
npx drizzle-kit generate

# Review the generated SQL in drizzle/ folder
# Then apply it manually or with:
npx drizzle-kit push
```

## Verify Migration

After running the migration, verify the tables exist:

```sql
-- Connect to your database and run:
\dt

-- You should see:
-- user
-- session
-- account
-- verification
-- site_stats (existing table)
```

## Troubleshooting

### "Connection timeout"
- Check if PostgreSQL is running
- Verify DATABASE_URL is correct
- Check firewall/network settings

### "Permission denied"
- Ensure database user has CREATE TABLE permissions
- Try connecting with a superuser account

### "Table already exists"
- If you get this error, the tables are already created
- You can safely ignore this or drop the tables and re-run

### "Cannot find module 'drizzle-kit'"
```bash
npm install drizzle-kit --save-dev
```

## Rollback

If you need to remove the auth tables:

```sql
-- Connect to your database and run:
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS user CASCADE;
```

## Production Deployment

For production, consider:

1. **Backup your database first**
   ```bash
   pg_dump your_database > backup.sql
   ```

2. **Test migration on staging first**

3. **Use a migration tool for zero-downtime**
   ```bash
   npx drizzle-kit generate
   # Review the SQL
   # Apply during maintenance window
   ```

4. **Monitor the migration**
   - Check logs for errors
   - Verify all tables created
   - Test authentication immediately after

## Next Steps

After successful migration:

1. ✅ Tables are created
2. ✅ Start your development server: `npm run dev`
3. ✅ Test registration: Click "Login" → "Sign up now"
4. ✅ Create your first user account
5. ✅ Verify login works
6. ✅ Check profile page at `/profile`

## Schema Changes

If you modify the schema in `src/db/schema.ts`, run:

```bash
npx drizzle-kit push
```

Drizzle will automatically detect and apply the changes.

## Need Help?

- Check `AUTH_SETUP.md` for detailed documentation
- Visit Better Auth docs: https://www.better-auth.com/
- Check Drizzle docs: https://orm.drizzle.team/

