# Admin Dashboard - Setup & Deployment Guide

Complete guide for setting up the organizer-only admin dashboard for managing blind voting elections.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Organizer User Creation](#organizer-user-creation)
4. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
5. [Environment Configuration](#environment-configuration)
6. [Election Assignment](#election-assignment)
7. [Local Development](#local-development)
8. [Deployment](#deployment)
9. [Security Best Practices](#security-best-practices)

---

## Prerequisites

- Supabase project (existing from main voting system)
- Node.js 16+ (for local development server)
- Basic understanding of SQL and RLS policies

---

## Supabase Setup

### Required Tables

Ensure these tables exist (should already be set up from main voting system):

- `elections` - Election metadata
- `candidates` - Candidate information
- `votes` - Cast votes
- `election_results` - Materialized view for aggregated results

### Required View: election_results

```sql
CREATE OR REPLACE VIEW election_results AS
SELECT 
    c.id as candidate_id,
    c.name as candidate_name,
    c.position,
    e.id as election_id,
    e.name as election_name,
    COUNT(v.id) as vote_count,
    ROUND(
        (COUNT(v.id)::numeric / NULLIF(
            (SELECT COUNT(*) FROM votes WHERE election_id = e.id), 
            0
        ) * 100), 
        2
    ) as vote_percentage
FROM candidates c
LEFT JOIN votes v ON v.candidate_id = c.id
LEFT JOIN elections e ON v.election_id = e.id OR e.id = 1 -- Replace 1 with your election ID
GROUP BY c.id, c.name, c.position, e.id, e.name
ORDER BY c.position, vote_count DESC;
```

---

## Organizer User Creation

### Step 1: Create Organizer Account via Supabase Dashboard

1. Navigate to **Authentication > Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Enter organizer credentials:
   ```
   Email: admin@yourdomain.com
   Password: [Secure password - min 8 characters]
   Auto Confirm User: ✓ (checked)
   ```
4. Click **Create user**
5. **Important**: Save the user UUID (found in user details)

### Step 2: Create Organizers Table

```sql
-- Create organizers table to track admin users
CREATE TABLE IF NOT EXISTS organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(email)
);

-- Enable RLS
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

-- Policy: Organizers can view their own record
CREATE POLICY "Organizers can view own record"
ON organizers FOR SELECT
USING (auth.uid() = user_id);
```

### Step 3: Assign User as Organizer

```sql
-- Replace with your organizer's user_id from Step 1
INSERT INTO organizers (user_id, email)
VALUES (
    '00000000-0000-0000-0000-000000000000', -- Replace with actual UUID
    'admin@yourdomain.com'
);
```

---

## Row Level Security (RLS) Policies

### Helper Function: Check if User is Organizer

Since your schema doesn't have a `user_id` column in organizers, you'll need to link auth users to organizers by email:

```sql
-- Create helper function to check organizer status by email
CREATE OR REPLACE FUNCTION is_organizer()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizers 
        WHERE email = auth.jwt()->>'email'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Elections Table Policies

```sql
-- Already enabled in your schema
-- ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy and recreate
DROP POLICY IF EXISTS "public_read_elections" ON elections;

-- Public can view all elections
CREATE POLICY "public_read_elections"
ON elections FOR SELECT
USING (true);

-- Organizers can manage elections
CREATE POLICY "organizers_manage_elections"
ON elections FOR ALL
USING (is_organizer())
WITH CHECK (is_organizer());
```

### Candidates Table Policies

```sql
-- Already enabled in your schema
-- ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy and recreate
DROP POLICY IF EXISTS "public_read_candidates" ON candidates;

-- Public can view candidates
CREATE POLICY "public_read_candidates"
ON candidates FOR SELECT
USING (true);

-- Organizers can manage candidates
CREATE POLICY "organizers_manage_candidates"
ON candidates FOR ALL
USING (is_organizer())
WITH CHECK (is_organizer());
```

### Voters and Votes Policies

```sql
-- Already enabled and configured in your schema
-- No changes needed for voters and votes tables
-- They allow public insert which is correct for device-based voting
```

## Organizer User Creation

### Step 1: Insert Organizer Record

Since your schema doesn't link to auth.users, you'll add organizers by email:

```sql
-- Insert admin organizer
INSERT INTO organizers (name, email)
VALUES ('Admin User', 'admin@voting.com')
ON CONFLICT (email) DO NOTHING;
```

### Step 2: Create Auth User in Supabase Dashboard

1. Go to **Authentication → Users**
2. Click **Add User → Create new user**
3. Enter:
   ```
   Email: admin@voting.com
   Password: Admin123!@#
   Auto Confirm User: ✓
   ```
4. Click **Create user**

The organizer check will work by matching the auth user's email with the organizers table email.

---

## Environment Configuration

### Step 1: Configure Supabase Client

Ensure `site/js/supabase.js` is properly configured:

```javascript
// filepath: e:\voting\site\js\supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-public-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 2: Update Configuration Values

1. **Supabase URL**: Found in Project Settings → API
2. **Anon Key**: Found in Project Settings → API → Project API keys
3. **Never commit** these values to public repositories

### Step 3: CORS Configuration

Ensure Supabase allows requests from your domain:

1. Go to **Authentication > URL Configuration**
2. Add your admin dashboard URL to **Site URL**
3. Add your domain to **Redirect URLs**:
   ```
   https://yourdomain.com/admin/dashboard.html
   http://localhost:3000/admin/dashboard.html (for development)
   ```

---

## Election Assignment

### Create Default Election

```sql
-- Create an election for organizers to manage
INSERT INTO elections (name, is_open, created_at)
VALUES ('Spring 2024 Student Council Election', false, NOW())
RETURNING id;

-- Note the returned ID for use in dashboard
```

### Assign Election to Organizer (Optional)

If you want to track which organizer manages which election:

```sql
-- Create election_organizers junction table
CREATE TABLE IF NOT EXISTS election_organizers (
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE,
    PRIMARY KEY (election_id, organizer_id)
);

-- Assign election to organizer
INSERT INTO election_organizers (election_id, organizer_id)
VALUES (
    'election-uuid-here',
    'organizer-uuid-here'
);
```

### Update Dashboard to Use Dynamic Election ID

In `admin/js/dashboard.js`, update the `loadElection()` function:

```javascript
async function loadElection() {
    // Get all elections and use the first one, or latest
    const elections = await adminAPI.getAllElections();
    if (elections.success && elections.data.length > 0) {
        const electionId = elections.data[0].id;
        const result = await adminAPI.getElectionStatus(electionId);
        // ...existing code...
    }
}
```

---

## Local Development

### Option 1: Using Python Simple Server

```bash
# From the voting directory
cd e:\voting
python -m http.server 3000

# Access admin dashboard at:
# http://localhost:3000/admin/index.html
```

### Option 2: Using Node.js http-server

```bash
# Install globally
npm install -g http-server

# Run from voting directory
cd e:\voting
http-server -p 3000

# Access admin dashboard at:
# http://localhost:3000/admin/index.html
```

### Option 3: Using VS Code Live Server

1. Install **Live Server** extension
2. Right-click `admin/index.html`
3. Select **Open with Live Server**

---

## Deployment

### Static Site Deployment Options

#### Option A: Netlify

1. **Create `netlify.toml`** in project root:

```toml
# filepath: e:\voting\netlify.toml
[build]
  publish = "."

[[redirects]]
  from = "/admin/*"
  to = "/admin/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
```

2. **Deploy**:
   - Connect GitHub repository to Netlify
   - Set build command: (none)
   - Set publish directory: `.`
   - Deploy

#### Option B: Vercel

1. **Create `vercel.json`** in project root:

```json
{
  "rewrites": [
    { "source": "/admin/(.*)", "destination": "/admin/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

2. **Deploy**:
```bash
npm install -g vercel
vercel
```

#### Option C: GitHub Pages

1. **Create `.nojekyll`** file in root
2. **Enable GitHub Pages** in repository settings
3. **Set source** to main branch
4. Access at: `https://username.github.io/repository-name/admin/`

#### Option D: Custom Server (Nginx)

```nginx
# filepath: /etc/nginx/sites-available/voting-admin
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/voting;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    location /admin {
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        try_files $uri $uri/ /site/index.html;
    }
}
```

---

## Security Best Practices

### 1. Password Requirements

- Minimum 12 characters for organizer accounts
- Use password manager
- Enable 2FA if Supabase supports it

### 2. API Key Security

- ❌ Never commit API keys to Git
- ✅ Use environment variables for local development
- ✅ Use Supabase's Row Level Security
- ✅ The anon key is safe to expose (RLS protects data)

### 3. RLS Testing

Test that non-organizers cannot access admin functions:

```sql
-- Test as anonymous user
SET request.jwt.claims TO '{}';

-- Should return 0 rows
SELECT * FROM candidates; -- Should work (public read)
INSERT INTO candidates (name, position) VALUES ('Test', 'President'); -- Should fail
UPDATE elections SET is_open = true WHERE id = 'some-id'; -- Should fail
```

### 4. Audit Logging (Optional)

Create audit log for admin actions:

```sql
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES organizers(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example trigger for candidate changes
CREATE OR REPLACE FUNCTION log_candidate_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO admin_audit_log (organizer_id, action, table_name, record_id, details)
    VALUES (
        (SELECT id FROM organizers WHERE user_id = auth.uid()),
        TG_OP,
        'candidates',
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidate_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON candidates
FOR EACH ROW EXECUTE FUNCTION log_candidate_changes();
```

### 5. Session Management

- Sessions expire after 1 hour by default (Supabase)
- Configure in Supabase Dashboard → Authentication → Settings
- Recommended: Set to 30 minutes for admin users

---

## Troubleshooting

### Cannot Login to Admin Dashboard

1. Verify user exists in Authentication → Users
2. Check user is in `organizers` table
3. Verify email/password are correct
4. Check browser console for errors

### RLS Policies Not Working

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- View all policies
SELECT * FROM pg_policies 
WHERE schemaname = 'public';

-- Test as organizer
SELECT is_organizer(); -- Should return true when logged in
```

### CORS Errors

1. Add your domain to Supabase Authentication → URL Configuration
2. Verify `supabaseUrl` in `supabase.js` matches your project
3. Check browser console for specific CORS error messages

### Live Results Not Updating

1. Verify Realtime is enabled in Supabase Dashboard → Database → Replication
2. Check browser console for subscription errors
3. Ensure `election_id` matches in subscriptions

---

## Support & Resources

- **Supabase Documentation**: https://supabase.com/docs
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Auth Guide**: https://supabase.com/docs/guides/auth

---

## License

MIT License - See main project LICENSE file