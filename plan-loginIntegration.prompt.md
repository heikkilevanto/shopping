# Plan: Integrate login.pm with SSO

Add cookie-based authentication to all three CGI entry points (index, api, photo) while maintaining SSO with beertracker. The shopping app will keep its simple structure without refactoring to context objects.

**TL;DR**: Add CGI.pm objects and auth checks to all three CGI files, wrap header output to send cookies, and update Apache config to enable `CGIPassAuth`. Since you want SSO, we'll use the same secret file and cookie name as beertracker. `login.pm` requires no changes — it now defaults to `./.htpasswd` (the directory the CGI runs from) and is **not to be modified** here (it lives in the beertracker project).

## Steps

### 1. Update index.cgi
- Add `use CGI;` and create `$q` object
- Call `login::authenticate()` early (before any output)
- Replace `$ENV{REMOTE_USER}` with authenticated username
- Call `login::prepare_cookie()` before headers
- Wrap `print` header output to include cookie from `header()` method
- Keep existing simple structure, minimal context

### 2. Update api.cgi
- Add `use CGI;` and create `$q` object  
- Add `login::authenticate()` at start
- Replace `$ENV{REMOTE_USER}` with authenticated username
- Create `send_header()` helper function that includes auth cookie
- Update all header output points (JSON, 404, 304, etc.) to use helper
- Preserve Last-Modified and conditional GET logic

### 3. Update photo.cgi
- Add `use CGI;` and create `$q` object
- Add `login::authenticate()` at start  
- Replace `$ENV{REMOTE_USER}` with authenticated username
- Create `send_header()` helper for image Content-Type + cookie
- Update all header outputs (JSON, images, errors) to use helper

### 4. Update etc/shopping-apache.conf
- Remove `AuthType Basic`, `AuthName`, `AuthUserFile`, `Require valid-user`
- Add `CGIPassAuth On` (enables HTTP Basic auth fallback)
- Add `Require all granted` (Apache doesn't enforce auth anymore)
- Keep existing `AcceptPathInfo On` and other directives

### 5. Verify configuration files exist
- Confirm `/var/www/html/shopping/.htpasswd` exists with users (login.pm will find it as `./.htpasswd` relative to the CGI document root)
- Confirm `/etc/lsd/login.secret` exists (shared with beertracker)
- Check permissions: secret file should be `640 root:www-data`

## Verification Steps

- Reload Apache config: `sudo systemctl reload apache2`
- Test index.cgi: Should prompt for Basic Auth or accept existing cookie
- Test that cookie persists across requests (no re-prompt)
- Create/read/update list via api.cgi endpoints
- Upload/view photo via photo.cgi
- Verify SSO: Log into beertracker, then access shopping (should not prompt)
- Check browser DevTools: Cookie `lsd_login` should be present, Secure, HttpOnly

## Decisions Made

- **SSO enabled**: Using shared `/etc/lsd/login.secret` and `lsd_login` cookie name allows seamless auth between beertracker and shopping
- **Minimal refactoring**: Keep shopping's simple procedural style; add auth without introducing context object pattern
- **All-at-once deployment**: Update all three CGI files and Apache config together to avoid mixed auth states
- **Local .htpasswd**: Uses your existing `/var/www/html/shopping/.htpasswd` for user validation

## Technical Notes

### Authentication Flow
1. Request arrives at CGI script
2. CGI creates `CGI->new` object
3. `login::authenticate()` checks cookie first, then HTTP Basic Auth
4. On success: sets username and continues
5. On failure: sends 401 with WWW-Authenticate header and exits
6. Before sending response: `login::prepare_cookie()` generates fresh cookie
7. Response headers include the auth cookie

### Cookie Format
- **Name**: `lsd_login`
- **Value**: `username:expiry:hmac` (signed with HMAC-SHA256)
- **Attributes**: Secure, HttpOnly, SameSite=Strict, 14-day expiry
- **Path**: `/` (available to all apps on the domain)

### Apache Configuration Changes
Current (Apache enforces auth):
```apache
AuthType Basic
AuthName "Shopping List"
AuthUserFile /var/www/html/shopping/.htpasswd
Require valid-user
```

New (Application enforces auth):
```apache
CGIPassAuth On
Require all granted
```

The `CGIPassAuth On` directive passes the `HTTP_AUTHORIZATION` header to CGI scripts, allowing login.pm to validate HTTP Basic Auth credentials.

## Files to Modify

1. `index.cgi` - Add CGI.pm and auth
2. `api.cgi` - Add CGI.pm, auth, and header wrapper
3. `photo.cgi` - Add CGI.pm, auth, and header wrapper
4. `etc/shopping-apache.conf` - Switch from Apache to app-level auth

> **Note**: `login.pm` is **not modified** here. It lives in the beertracker project and defaults to `./.htpasswd`, which resolves to `/var/www/html/shopping/.htpasswd` when called from the shopping CGI scripts.
