# Authentication Service

A comprehensive OAuth 2.0 authentication service with user management, project access control, and OAuth application management.

## Features

- **User Authentication**: JWT-based session management
- **OAuth 2.0 Flow**: Complete OAuth authorization code flow
- **Project Management**: Role-based access control for projects
- **OAuth Applications**: Create and manage OAuth applications
- **Connected Apps**: View and manage applications with active access
- **API Endpoints**: Token validation and user information APIs

## API Endpoints

### Authentication APIs

#### Verify Token
Validates any token (user session or OAuth access token).

```http
GET /api/v1/verify?token=YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "valid": true,
  "type": "user_token"  // or "oauth_token"
}
```

#### Get User Information
Returns user details for the provided token.

```http
GET /api/v1/get_user?token=YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "username": "austin",
  "permissions": ["admin"]
}
```

#### Get Projects
Returns projects accessible to the user.

```http
GET /api/v1/get_projects?token=YOUR_TOKEN_HERE
```

## OAuth 2.0 Flow Guide

### Complete Flow: Authorization → Access Token → API Testing

#### Step 1: Get Authorization Code
Visit this URL in your browser (replace `CLIENT_ID` with your OAuth app's client_id):

```
http://localhost:3000/oauth/authorize?client_id=CLIENT_ID&redirect_uri=https://austinsdk.me&response_type=code
```

This redirects to: `https://austinsdk.me/?code=AUTHORIZATION_CODE_HERE`

**Copy the authorization code** from the URL.

#### Step 2: Exchange Code for Access Token
Use a POST request to exchange the authorization code for a permanent access token:

**Request:**
```http
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "YOUR_CODE_HERE",
  "redirect_uri": "https://austinsdk.me", 
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```

**Response:**
```json
{
  "access_token": "permanent_access_token_here",
  "token_type": "Bearer", 
  "expires_in": null,
  "scope": ""
}
```

**Copy the access_token** - it's permanent until revoked.

#### Step 3: Test API Endpoints

**Verify Token:**
```http
GET /api/v1/verify?token=YOUR_ACCESS_TOKEN
```

**Get User Info:**
```http  
GET /api/v1/get_user?token=YOUR_ACCESS_TOKEN
```

**Get Projects:**
```http
GET /api/v1/get_projects?token=YOUR_ACCESS_TOKEN
```

#### Step 4: View Connected Apps
Visit `http://localhost:3000/oauth` to see your OAuth applications and connected apps with active access tokens.

## Testing Tools

You can use any HTTP client to test the APIs:

- **curl** (Linux/macOS/Windows)
- **Postman** 
- **Insomnia**
- **HTTPie**
- **Browser** (for GET requests)
- **PowerShell** (Invoke-WebRequest)
- **Node.js** (fetch/axios)

### Example with curl:
```bash
# Verify token
curl "http://localhost:3000/api/v1/verify?token=YOUR_TOKEN"

# Get user info  
curl "http://localhost:3000/api/v1/get_user?token=YOUR_TOKEN"

# Exchange authorization code (POST)
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"authorization_code","code":"YOUR_CODE","redirect_uri":"https://austinsdk.me","client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}'
```

## Token Types

| Token Type | Duration | Usage | Source |
|------------|----------|-------|---------|
| **User Session Token (JWT)** | Until logout | Web app + API calls | Login |
| **OAuth Access Token** | Permanent* | API calls | OAuth flow |
| **Authorization Code** | 10 minutes | Single-use exchange | OAuth redirect |

*Access tokens are permanent until the user revokes access or the OAuth application is deleted.

## Token Usage Methods

All API endpoints accept tokens via:

1. **Query Parameter:** `?token=YOUR_TOKEN`
2. **Authorization Header:** `Authorization: Bearer YOUR_TOKEN`

## Web Interface

- **`/oauth`** - Manage OAuth applications and view connected apps
- **`/oauth/create`** - Create new OAuth application
- **`/projects`** - Manage projects and permissions
- **`/users`** - User management (admin only)

## Getting Started

1. **Login** to get a user session token
2. **Create OAuth App** at `/oauth/create` 
3. **Follow OAuth Flow** using the steps above
4. **Test APIs** with your access tokens
5. **Manage Connected Apps** at `/oauth`

## Security Notes

- Access tokens are permanent - revoke when no longer needed
- Authorization codes expire in 10 minutes
- User session tokens persist until logout
- Admin permissions required for user management
- OAuth applications are tied to their creators
