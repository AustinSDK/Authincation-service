require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const db = require("./libs/db")

const path = require("path");
const fs = require("fs")

const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const auth = require("./libs/auth")(express,db);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Add cache-control headers to prevent caching issues
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
});

app.use((req,res,next)=>{
    if (!req.cookies || !req.cookies.token){
        req.user = false;
    } else {
        let user = auth.getUserFromToken(req.cookies.token);

        if (user) {
            try {
                // Handle case where permissions might be null, undefined, empty string, array, or malformed JSON
                if (!user.permissions) {
                    user.permissions = [];
                } else if (Array.isArray(user.permissions)) {
                    // Already an array, use as is
                    user.permissions = user.permissions;
                } else if (typeof user.permissions === 'string') {
                    if (user.permissions.trim() === '') {
                        user.permissions = [];
                    } else {
                        user.permissions = JSON.parse(user.permissions);
                    }
                } else {
                    // Unknown type, default to empty array
                    user.permissions = [];
                }
            } catch (error) {
                console.error('Error parsing user permissions:', error);
                console.error('Problematic permissions value:', user.permissions);
                console.error('Permissions type:', typeof user.permissions);
                user.permissions = [];
            }
            user.admin = user.permissions.includes("admin");
            user.token = req.cookies.token;
            req.user = user;
        } else {
            req.user = false;
        }
    }
    next();
});

let globalPermissions = []

app.use(auth.router);

app.set("views", path.join(__dirname, "pages"));
app.set("view engine", "ejs");

// dynamic file paths

// css paths
app.get("/css/:path",(req,res,next)=>{
    // get path
    const css_path = path.join(__dirname,'css');
    const _path = path.join(css_path,req.params.path);

    // check path to make sure its real
    if (!_path.startsWith(css_path)) return next();

    // send file
    if (!fs.existsSync(_path)) return next();
    res.sendFile(_path);
});

// js paths
app.get("/js/:path",(req,res,next)=>{
    // get path
    const js_path = path.join(__dirname,'js');
    const _path = path.join(js_path,req.params.path);

    // check path to make sure its real
    if (!_path.startsWith(js_path)) return next();

    // send file
    if (!fs.existsSync(_path)) return next();
    res.sendFile(_path);
});

// User auth endpoints? static.
app.get("/register",async (req,res,next)=>{
    res.render("register.ejs", { user: req.user || null })
})
app.get("/login",async (req,res,next)=>{
    res.render("login.ejs", { user: req.user || null })
})

// Static file paths
app.get("/",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    console.log(projects)
    res.render("index.ejs",{user:user,projects:projects});
});
app.get("/projects",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("projects.ejs",{user:user,projects:projects});
});
app.get("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("create-project.ejs",{user:user,projects:projects});
});

app.get("/settings",(req,res,next)=>{
    if (!req.user){
        return res.redirect('/login');
    }
    res.redirect(`/user/${req.user.id}/settings`)
})

// user specfic stuff
app.get("/user/:id/settings", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user || (user.id !== id && (!user.admin))){
        return res.redirect("/login")
    }
    let _user = auth.getUserById(id)
    if (!_user) return next()
    res.render("user-settings",{tokens:auth.getUserTokens(id),user:req.user, query:req.query, id:id, _user:_user})
})

// All users
app.get("/users", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user || (user.id !== id && (!user.admin))){
        return res.redirect("/login")
    }
    let users = auth.db.prepare("SELECT * FROM USERS;").all()
    res.render('users',{user:req.user,users:users})
})

// project settings
app.get("/project/:id", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user || !user.permissions.includes("editor") && !user.admin){
        return res.redirect("/login")
    }
    let project = auth.getProjectFromId(id)
    if (!project){
        return res.redirect("/projects")
    }
    res.render("modify-project",{tokens:auth.getUserTokens(id),user:req.user,project:project})
})

// logout!!!!!
app.get('/logout',(req,res,next)=>{
    auth.db.prepare("DELETE FROM tokens WHERE token = ?").run(req.user.token)
    return res.redirect("/")
})

// projects creation :shrug:
app.post("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check if user has proper permissions to create projects
    if (!user.admin && !user.permissions.includes("editor")) {
        return res.status(403).json({ message: "Insufficient permissions to create projects" });
    }
    
    try {
        const { name, description, link, permissions } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Project name is required" });
        }
        
        const result = auth.createProject(name.trim(), description || "", link || "/", permissions || []);
        res.json({ 
            message: "Project created successfully",
            projectId: result.lastInsertRowid
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// projects update
app.post("/projects/update",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check if user has proper permissions to update projects
    if (!user.admin && !user.permissions.includes("editor")) {
        return res.status(403).json({ message: "Insufficient permissions to update projects" });
    }
    
    try {
        const { id, name, description, link, permissions } = req.body;
        
        if (!id) {
            return res.status(400).json({ message: "Project ID is required" });
        }
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Project name is required" });
        }
        
        const result = auth.updateProject(parseInt(id, 10), name.trim(), description || "", link || "/", permissions || []);
        res.json({ 
            message: "Project updated successfully",
            result
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});
app.post("/projects/delete",(req,res)=>{
    let user = req.user
    if (!user || !user.permissions){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.body || !req.body.id){
        return res.status(400).json({ message: "Project ID is required" });
    }
    
    // Check if user has admin permissions or is the project owner
    if (!user.admin) {
        return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    try {
        const result = auth.deleteProject(parseInt(req.body.id, 10));
        res.json({ message: "Project deleted successfully", result });
    } catch (error) {
        console.error("Error deleting project:", error);
        if (error.message === "Project not found") {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: "Error deleting project: " + error.message });
        }
    }
})

// User permissions management endpoints
app.get("/user/permissions",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const permissions = auth.getUserPermissionsById(user.id);
        res.json({ permissions });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving user permissions" });
    }
});

app.post("/user/permissions",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { permissions, userId } = req.body;
        
        if (!Array.isArray(permissions)) {
            console.error('Invalid permissions format received:', typeof permissions);
            return res.status(400).json({ message: "Permissions must be an array" });
        }
        
        // Validate permission values
        const invalidPerms = permissions.filter(p => typeof p !== 'string' || !p.trim());
        if (invalidPerms.length > 0) {
            console.error('Invalid permission values:', invalidPerms);
            return res.status(400).json({ message: "All permissions must be non-empty strings" });
        }
        
        // Determine which user's permissions to update
        let targetUserId = user.id; // Default to updating own permissions
        
        // If userId is provided and user is admin, allow updating other users
        if (userId && user.admin) {
            targetUserId = parseInt(userId, 10);
            if (!targetUserId || isNaN(targetUserId)) {
                console.error('Invalid user ID provided:', userId);
                return res.status(400).json({ message: "Invalid user ID" });
            }
            
            // Check that target user exists
            const targetUser = auth.getUserById(targetUserId);
            if (!targetUser) {
                console.error('Target user not found:', targetUserId);
                return res.status(404).json({ message: "Target user not found" });
            }
        } else if (userId && !user.admin) {
            console.error('Non-admin user attempted to update other user permissions:', user.id, '->', userId);
            return res.status(403).json({ message: "Permission denied: Only admins can update other users' permissions" });
        }
        
        console.log(`Updating permissions for user ${targetUserId}:`, permissions);
        const result = auth.updateUserPermissions(targetUserId, permissions);
        
        // Return both the result metadata and the updated user object
        res.json({ 
            message: `Successfully updated user permissions (${result.count} permissions)`,
            permissions: result.user.permissions,
            user: result.user
        });
    } catch (error) {
        console.error('Error in /user/permissions endpoint:', error.message);
        
        // Map specific errors to appropriate status codes
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        } else if (error.message.includes('Permissions must be')) {
            return res.status(400).json({ message: error.message });
        } else {
            return res.status(500).json({ message: "Internal server error while updating permissions" });
        }
    }
});

// Reset user password (admin only)
app.post("/resetPassword", async (req, res) => {
    let user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { userid, password } = req.body;
        
        if (!userid || !password) {
            return res.status(400).json({ message: "User ID and password are required" });
        }

        const result = await auth.resetUserPassword(parseInt(userid, 10), password, user.id);
        res.json({ message: "Password reset successfully" });
        
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update user personal information (own account only, not even admins can change others)
app.post("/user/update-info", async (req, res) => {
    let user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { email, display_name } = req.body;
        
        if (!email || !display_name) {
            return res.status(400).json({ message: "Email and display name are required" });
        }

        // Users can only update their own personal information
        // Not even admins can change someone else's personal data
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        
        // Check if email is already taken by another user
        const existingUser = auth.db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, user.id);
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use by another account" });
        }
        
        // Update user information
        auth.db.prepare("UPDATE users SET email = ?, display_name = ? WHERE id = ?")
            .run(email, display_name, user.id);
        
        // Force cache refresh by clearing and reloading the user from database
        // This ensures the next request will fetch the updated user data
        auth.refreshUserCache(user.id);
        
        res.json({ message: "Personal information updated successfully" });
        
    } catch (error) {
        console.error('Error updating user info:', error);
        res.status(500).json({ message: "Error updating personal information" });
    }
});

// Delete user account (admin only)
app.post("/deleteAccount", (req, res) => {
    let user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { userid } = req.body;
        
        if (!userid) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const result = auth.deleteUserAccount(parseInt(userid, 10), user.id);
        res.json({ message: "User account deleted successfully" });
        
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// OAuth Applications Management Routes
app.get("/oauth",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let _applications
    if (user.admin){
        _applications = auth.getOAuthApplications()
    }
    let applications = auth.getOAuthApplications(user.id)
    let connectedApps = auth.getConnectedApplications(user.id)
    
    // Debug log to see what's being returned
    console.log('User ID:', user.id);
    console.log('Applications:', applications.length);
    console.log('Connected Apps:', connectedApps.length);
    
    res.render("oauth.ejs",{user:user,applications:applications,connectedApps:connectedApps,user:req.user,_applications:_applications});
});

app.get("/oauth/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    res.render("create-oauth.ejs",{user:user});
});

app.post("/oauth/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { name, description, redirect_uris, scopes } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Application name is required" });
        }
        
        let redirectUrisArray = [];
        if (typeof redirect_uris === 'string') {
            redirectUrisArray = redirect_uris.split('\n').filter(uri => uri.trim());
        } else if (Array.isArray(redirect_uris)) {
            redirectUrisArray = redirect_uris;
        }
        
        let scopesArray = [];
        if (typeof scopes === 'string') {
            scopesArray = scopes.split(' ').filter(scope => scope.trim());
        } else if (Array.isArray(scopes)) {
            scopesArray = scopes;
        }
        
        const result = auth.createOAuthApplication(name.trim(), description || "", redirectUrisArray, scopesArray, user.id);
        res.json({ 
            message: "OAuth application created successfully",
            application: result.application
        });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

app.post("/oauth/update",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { id, name, description, redirect_uris, scopes } = req.body;
        
        if (!id || !name || !name.trim()) {
            return res.status(400).json({ message: "Application ID and name are required" });
        }
        
        // Check if user owns this OAuth application or is admin
        const appId = parseInt(id);
        const applications = user.admin ? auth.getOAuthApplications() : auth.getOAuthApplications(user.id);
        const existingApp = applications.find(app => app.id === appId);
        
        if (!existingApp) {
            return res.status(404).json({ message: "OAuth application not found or unauthorized" });
        }
        
        let redirectUrisArray = [];
        if (typeof redirect_uris === 'string') {
            redirectUrisArray = redirect_uris.split('\n').filter(uri => uri.trim());
        } else if (Array.isArray(redirect_uris)) {
            redirectUrisArray = redirect_uris;
        }
        
        let scopesArray = [];
        if (typeof scopes === 'string') {
            scopesArray = scopes.split(' ').filter(scope => scope.trim());
        } else if (Array.isArray(scopes)) {
            scopesArray = scopes;
        }
        
        // Use the original owner's user_id for the update, even if admin is making the change
        const ownerUserId = user.admin ? existingApp.user_id : user.id;
        const result = auth.updateOAuthApplication(appId, name.trim(), description || "", redirectUrisArray, scopesArray, ownerUserId);
        
        if (result.success) {
            res.json({ message: "OAuth application updated successfully" });
        } else {
            res.status(404).json({ message: "OAuth application not found or unauthorized" });
        }
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

app.post("/oauth/delete",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({ message: "Application ID is required" });
        }
        
        // Check if user owns this OAuth application or is admin
        const appId = parseInt(id);
        const applications = user.admin ? auth.getOAuthApplications() : auth.getOAuthApplications(user.id);
        const existingApp = applications.find(app => app.id === appId);
        
        if (!existingApp) {
            return res.status(404).json({ message: "OAuth application not found or unauthorized" });
        }
        
        // Use the original owner's user_id for the delete, even if admin is making the change
        const ownerUserId = user.admin ? existingApp.user_id : user.id;
        const result = auth.deleteOAuthApplication(appId, ownerUserId);
        
        if (result.success) {
            const message = `OAuth application deleted successfully. ${result.tokensDeleted} access tokens and ${result.codesDeleted} authorization codes were also removed.`;
            res.json({ message: message });
        } else if (result.error) {
            res.status(404).json({ message: result.error });
        } else {
            res.status(404).json({ message: "OAuth application not found or unauthorized" });
        }
    } catch (error) {
        console.error("Error deleting OAuth application:", error);
        return res.status(500).json({ message: "Internal server error while deleting OAuth application" });
    }
});

app.post("/oauth/revoke",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { client_id } = req.body;
        
        if (!client_id) {
            return res.status(400).json({ message: "Client ID is required" });
        }
        
        const result = auth.revokeApplicationAccess(user.id, client_id);
        
        if (result.success) {
            res.json({ message: `Successfully revoked access. ${result.deletedTokens} token(s) removed.` });
        } else {
            res.status(404).json({ message: "No active tokens found for this application" });
        }
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

// OAuth Authorization and Token Endpoints
app.get("/oauth/authorize",(req,res)=>{
    const { client_id, redirect_uri, response_type, scope, state } = req.query;
    
    if (!client_id || !redirect_uri || response_type !== 'code') {
        return res.status(400).json({ 
            error: "invalid_request",
            error_description: "Missing or invalid parameters"
        });
    }
    
    // Verify client
    const application = auth.getOAuthApplicationByClientId(client_id);
    if (!application) {
        return res.status(400).json({
            error: "invalid_client",
            error_description: "Invalid client_id"
        });
    }
    
    // Verify redirect URI
    if (!application.redirect_uris.includes(redirect_uri)) {
        return res.status(400).json({
            error: "invalid_request",
            error_description: "Invalid redirect_uri"
        });
    }
    
    // Check if user is authenticated
    if (!req.user) {
        // Store authorization request in session and redirect to login
        return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    
    // Generate authorization code
    try {
        const code = auth.generateAuthorizationCode(client_id, req.user.id, redirect_uri, scope || "");
        
        // Redirect back to client with authorization code
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.append('code', code);
        if (state) {
            redirectUrl.searchParams.append('state', state);
        }
        
        return res.redirect(redirectUrl.toString());
    } catch (error) {
        return res.status(500).json({
            error: "server_error",
            error_description: "Failed to generate authorization code"
        });
    }
});

app.post("/oauth/token",(req,res)=>{
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;
    
    if (grant_type !== 'authorization_code') {
        return res.status(400).json({
            error: "unsupported_grant_type",
            error_description: "Only authorization_code grant type is supported"
        });
    }
    
    if (!code || !redirect_uri || !client_id || !client_secret) {
        return res.status(400).json({
            error: "invalid_request",
            error_description: "Missing required parameters"
        });
    }
    
    try {
        const result = auth.exchangeCodeForToken(code, client_id, client_secret, redirect_uri);
        
        if (result.success) {
            res.json({
                access_token: result.access_token,
                token_type: result.token_type,
                expires_in: result.expires_in,
                scope: result.scope
            });
        } else {
            res.status(400).json({
                error: "invalid_grant",
                error_description: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            error: "server_error",
            error_description: "Failed to exchange authorization code"
        });
    }
});

app.get("/oauth/:id", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user){
        return res.redirect("/login")
    }
    
    // Get all applications if admin, otherwise only user's applications
    let applications;
    if (user.admin) {
        applications = auth.getOAuthApplications(); // Get all applications for admin
    } else {
        applications = auth.getOAuthApplications(user.id); // Get only user's applications
    }
    
    let application = applications.find(app => app.id === id)
    if (!application){
        return res.redirect("/oauth")
    }
    res.render("modify-oauth.ejs",{user:req.user,application:application})
})

// OAuth Token Validation API Endpoint
app.post("/api/v1/oauth/validate_token",(req,res)=>{
    const { access_token } = req.body;
    
    if (!access_token) {
        return res.status(400).json({
            error: "invalid_request",
            error_description: "access_token parameter is required"
        });
    }
    
    try {
        const validation = auth.validateAccessToken(access_token);
        
        if (validation.valid) {
            // Get user info for the token
            const user = auth.getUserById(validation.token.user_id);
            if (user) {
                res.json({
                    valid: true,
                    user_id: user.id,
                    username: user.username,
                    client_id: validation.token.client_id,
                    scope: validation.token.scope,
                    expires_at: validation.token.expires_at
                });
            } else {
                res.status(401).json({
                    error: "invalid_token",
                    error_description: "Token user not found"
                });
            }
        } else {
            res.status(401).json({
                error: "invalid_token",
                error_description: validation.error
            });
        }
    } catch (error) {
        res.status(500).json({
            error: "server_error",
            error_description: "Failed to validate token"
        });
    }
});

/* 
 * API requests
 * Invidual methods for each api
 */
/*
 * API get requests
 */
app.get("/api/v1/verify",(req,res,next)=>{
    const token = req.headers.authorization?.replace('Bearer ', '')  || req.query.token;
    
    if (!token) {
        return res.status(200).json({ valid: false, message: "No token provided" });
    }
    
    // Check if it's a regular user token
    const user = auth.getUserFromToken(token);
    if (user) {
        return res.status(200).json({ valid: true, type: "user_token" });
    }
    
    // Check if it's an OAuth access token
    const oauthValidation = auth.validateAccessToken(token);
    if (oauthValidation && oauthValidation.valid) {
        return res.status(200).json({ valid: true, type: "oauth_token" });
    }
    
    return res.status(200).json({ valid: false, message: "Invalid token" });
});

app.get("/api/v1/get_projects",(req,res,next)=>{
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        req.error = "no token provided";
        return next();
    }
    
    // First try regular user token
    let user = auth.getUserFromToken(token);
    
    // If not found, try OAuth access token
    if (!user) {
        const oauthValidation = auth.validateAccessToken(token);
        if (oauthValidation && oauthValidation.valid && oauthValidation.token) {
            user = auth.getUserById(oauthValidation.token.user_id);
        }
    }
    
    if (!user) {
        req.error = "invalid token or user not found";
        return next();
    }
    
    // Handle user permissions parsing
    try {
        if (!user.permissions) {
            user.permissions = [];
        } else if (Array.isArray(user.permissions)) {
            user.permissions = user.permissions;
        } else if (typeof user.permissions === 'string') {
            if (user.permissions.trim() === '') {
                user.permissions = [];
            } else {
                user.permissions = JSON.parse(user.permissions);
            }
        } else {
            user.permissions = [];
        }
    } catch (error) {
        console.error('Error parsing user permissions:', error);
        user.permissions = [];
    }
    
    let projects = auth.getProjects(user.permissions);
    return res.status(200).json(projects);
});
app.get("/api/v1/get_user",(req,res,next)=>{
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
        req.error = "no token provided";
        return next();
    }
    
    // First try regular user token
    let user = auth.getUserFromToken(token);
    if (user) {
        // Handle user permissions parsing
        try {
            if (!user.permissions) {
                user.permissions = [];
            } else if (Array.isArray(user.permissions)) {
                user.permissions = user.permissions;
            } else if (typeof user.permissions === 'string') {
                if (user.permissions.trim() === '') {
                    user.permissions = [];
                } else {
                    user.permissions = JSON.parse(user.permissions);
                }
            } else {
                user.permissions = [];
            }
        } catch (error) {
            console.error('Error parsing user permissions:', error);
            user.permissions = [];
        }
        
        delete user.password;
        return res.status(200).json({
            username: user.username,
            permissions: user.permissions
        });
    }
    
    // Try OAuth access token
    const oauthValidation = auth.validateAccessToken(token);
    if (oauthValidation && oauthValidation.valid) {
        if (oauthValidation.token && oauthValidation.token.user_id) {
            const oauthUser = auth.getUserById(oauthValidation.token.user_id);
            if (oauthUser) {
            // Handle user permissions parsing
            try {
                if (!oauthUser.permissions) {
                    oauthUser.permissions = [];
                } else if (Array.isArray(oauthUser.permissions)) {
                    oauthUser.permissions = oauthUser.permissions;
                } else if (typeof oauthUser.permissions === 'string') {
                    if (oauthUser.permissions.trim() === '') {
                        oauthUser.permissions = [];
                    } else {
                        oauthUser.permissions = JSON.parse(oauthUser.permissions);
                    }
                } else {
                    oauthUser.permissions = [];
                }
            } catch (error) {
                console.error('Error parsing user permissions:', error);
                oauthUser.permissions = [];
            }
            
            delete oauthUser.password;
            return res.status(200).json({
                username: oauthUser.username,
                permissions: oauthUser.permissions
            });
        }
    }
    }
    
    req.error = "invalid token or user not found";
    return next();
});

// 404 page 
app.use((req,res,next)=>{
    if (req.path.startsWith("/api/v1/")) {
        if (!req.error){
            req.error = "No api endpoint found."
        }
        return res.status(400).json({status:"error",message:req.error})
    }
    res.render("404", {user:req.user})
})

const port = process.env.PORT
app.listen(port,e=>{
    if (e){
        console.error(e);
        return;
    }
    console.log("hosting on port "+port);
});
