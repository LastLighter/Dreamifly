# Authentication Setup Guide

This project uses [Better Auth](https://www.better-auth.com/) for authentication. The implementation includes email/password authentication, user profile management, and password reset functionality.

## Features Implemented

✅ Email/Password Authentication
✅ User Registration with default avatar and nickname
✅ User Login
✅ Password Reset (UI ready, backend needs email configuration)
✅ User Profile Management (avatar, nickname)
✅ Password Change
✅ Session Management
✅ Multi-language Support (Chinese, English, Traditional Chinese)

## Database Schema

The following tables have been added to the database:

### `user` table
- `id` (text, primary key)
- `name` (text, not null)
- `email` (text, unique, not null)
- `emailVerified` (boolean, default: false)
- `image` (text)
- `avatar` (text, default: "/images/default-avatar.svg")
- `nickname` (text)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `session` table
- `id` (text, primary key)
- `expiresAt` (timestamp)
- `token` (text, unique)
- `ipAddress` (text)
- `userAgent` (text)
- `userId` (text, foreign key to user.id)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `account` table
- `id` (text, primary key)
- `accountId` (text)
- `providerId` (text)
- `userId` (text, foreign key to user.id)
- `password` (text, hashed)
- `accessToken` (text)
- `refreshToken` (text)
- `idToken` (text)
- `accessTokenExpiresAt` (timestamp)
- `refreshTokenExpiresAt` (timestamp)
- `scope` (text)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `verification` table
- `id` (text, primary key)
- `identifier` (text)
- `value` (text)
- `expiresAt` (timestamp)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## Migration

To apply the database schema changes, run:

```bash
# Generate migration
npx drizzle-kit generate

# Push to database
npx drizzle-kit push
```

Or use the Better Auth CLI:

```bash
npx @better-auth/cli migrate
```

## Environment Variables

Make sure your `.env` file includes:

```env
DATABASE_URL=your_postgresql_connection_string
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your production URL
BETTER_AUTH_SECRET=your_secret_key_here  # Generate with: openssl rand -base64 32
```

## File Structure

```
src/
├── lib/
│   ├── auth.ts              # Better Auth server configuration
│   └── auth-client.ts       # Better Auth client for React
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts # Auth API route handler
│   └── [locale]/
│       └── profile/
│           └── page.tsx     # User profile page
├── components/
│   ├── AuthModal.tsx        # Login/Register modal
│   └── Navbar.tsx           # Updated with auth UI
└── messages/
    ├── zh.json              # Chinese translations
    ├── en.json              # English translations
    └── zh-TW.json           # Traditional Chinese translations
```

## Usage

### Client-Side

```tsx
import { useSession, signIn, signUp, signOut } from '@/lib/auth-client'

function MyComponent() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div>Loading...</div>
  
  if (session?.user) {
    return (
      <div>
        <p>Welcome, {session.user.name}!</p>
        <button onClick={() => signOut()}>Logout</button>
      </div>
    )
  }

  return <button onClick={() => signIn.email({ email, password })}>Login</button>
}
```

### Server-Side

```tsx
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return Response.json({ user: session.user })
}
```

## Components

### AuthModal
A modal component for login, registration, and password reset.

```tsx
<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  initialMode="login" // or "register" or "reset"
/>
```

### Profile Page
Located at `/[locale]/profile`, allows users to:
- Update their nickname
- Change their avatar
- Change their password
- Logout

## API Endpoints

All authentication endpoints are automatically handled by Better Auth at `/api/auth/*`:

- `POST /api/auth/sign-in/email` - Email/password login
- `POST /api/auth/sign-up/email` - Email/password registration
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/update-user` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/forget-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

## Default User Experience

When a user registers:
1. They provide nickname, email, and password (no real name required)
2. The nickname is used as both the display name and internal name
3. A default avatar (`/images/default-avatar.svg`) is assigned
4. They are automatically logged in
5. They can access their profile at `/profile` to customize their avatar and nickname

## Security Features

- Passwords are hashed using bcrypt
- Sessions expire after 7 days
- CSRF protection enabled
- Secure cookie settings
- Session tokens are unique and cryptographically secure

## Customization

### Change Session Duration

Edit `src/lib/auth.ts`:

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24, // 1 day
}
```

### Enable Email Verification

Edit `src/lib/auth.ts`:

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
}
```

You'll also need to configure email sending. See [Better Auth Email Documentation](https://www.better-auth.com/docs/authentication/email-password#email-verification).

### Add Social Providers

Edit `src/lib/auth.ts`:

```typescript
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  },
}
```

## Troubleshooting

### "Database connection failed"
- Verify your `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check network connectivity to database

### "Session not found"
- Clear browser cookies
- Check that `BETTER_AUTH_SECRET` is set
- Verify the auth API route is accessible at `/api/auth/*`

### "Avatar upload failed"
- Ensure the `/api/upload` endpoint exists and is working
- Check file size limits (currently 2MB)
- Verify file type is JPG, PNG, or GIF

## Next Steps

To complete the implementation:

1. **Email Configuration**: Set up email sending for password reset
2. **Avatar Upload**: Implement the `/api/upload` endpoint for avatar uploads
3. **Email Verification**: Enable and configure email verification if needed
4. **Social Login**: Add social providers (GitHub, Google, etc.) if desired
5. **Rate Limiting**: Add rate limiting to prevent abuse
6. **Two-Factor Authentication**: Consider adding 2FA for enhanced security

## Resources

- [Better Auth Documentation](https://www.better-auth.com/)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

