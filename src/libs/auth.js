// > TODO: Cache tokens!

const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const Joi = require("joi");
const rateLimit = require("express-rate-limit").rateLimit;

const limiter = rateLimit({
    windowMs: 3 * 60 * 1000,
    limit:10,
    standardHeaders:"draft-8",
    legacyHeaders:false,
    ipv6Subnet:56
})

// Define validation schema
const userSchema = Joi.object({
    username: Joi.string()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
            'string.base': 'Username must be a string',
            'string.empty': 'Username is required',
            'string.alphanum': 'Username must only contain letters and numbers',
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username must be at most 30 characters long',
            'any.required': 'Username is required'
        }),
    password: Joi.string()
        .min(8)
        .max(128)
        .required()
});

async function hash(p){
    return await argon2.hash(p);
}
async function compare(hash,p){
    try{
        return await argon2.verify(hash,p);
    } catch(err){
        return false;
    }
}

let projects = {};
let _projects_chached = false;
let users = {};
class mhm{
    constructor(express,db){
        this.db = db;
        this.router = express.Router();
        this.router.post("/login", limiter, async (req, res) => {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ message: "Username and password required" });
            }
            // Case-insensitive username lookup
            const user = this.db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username);
            if (!user) return res.status(400).json({ message: "Invalid credentials" });

            // Compare password with hash
            const validify = await compare(user.password, password);
            if (!validify) return res.status(400).json({ message: "Invalid credentials" });

            users[String(user.id)] = user;

            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET || "qsd90!h3l2$!@asdn1p9dfn12h*#asdnj2"
            );
            this.db.prepare("INSERT INTO tokens (uuid,token) VALUES (?,?)").run(user.id, token);

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "lax",
                path: "/"
            });
            res.json({ message: "Login successful" });
        });
        this.router.post("/register", limiter, async (req,res)=>{
            try {
                const { username, password, email, display_name } = req.body;
                const crypto = require('crypto');

                console.log(req.body)
                
                // First validate the input
                const { error, value } = userSchema.validate({
                    username: username,
                    password: password
                });
                if (error) {
                    return res.status(400).json({
                        message: error.details[0].message
                    });
                }

                // Validate email if provided, or generate UUID email
                let trimmedEmail = null;
                let emailVerified = 0; // Default to unverified
                
                if (email && email.trim()) {
                    // Real email provided - mark as unverified and will send verification email
                    trimmedEmail = email.trim().toLowerCase();
                    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(trimmedEmail)) {
                        return res.status(400).json({ message: "Invalid email format" });
                    }
                    
                    if (trimmedEmail.length > 254) {
                        return res.status(400).json({ message: "Email address is too long" });
                    }
                    
                    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.') || 
                        trimmedEmail.includes('..') || trimmedEmail.split('@')[0].length > 64) {
                        return res.status(400).json({ message: "Invalid email format" });
                    }
                    
                    // Check if email already exists
                    const existingEmail = this.db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(trimmedEmail);
                    if (existingEmail) {
                        return res.status(400).json({ message: "Email already in use" });
                    }
                    emailVerified = 0; // Requires verification
                } else {
                    // No email provided - generate UUID email and mark as verified
                    const uuid = crypto.randomUUID();
                    trimmedEmail = `${uuid}@auth.austinsdk.me`;
                    emailVerified = 1; // Auto-verify UUID emails
                }

                // Validate display_name if provided
                let validatedDisplayName = display_name;
                if (display_name && display_name.trim()) {
                    const trimmedDisplayName = display_name.trim();
                    
                    if (trimmedDisplayName.length < 2) {
                        return res.status(400).json({ message: "Display name must be at least 2 characters long" });
                    }
                    if (trimmedDisplayName.length > 50) {
                        return res.status(400).json({ message: "Display name must be at most 50 characters long" });
                    }
                    
                    const displayNameRegex = /^[a-zA-Z0-9 ]+$/;
                    if (!displayNameRegex.test(trimmedDisplayName)) {
                        return res.status(400).json({ message: "Display name can only contain letters, numbers, and spaces" });
                    }
                    
                    validatedDisplayName = trimmedDisplayName;
                }

                // Then check blocked usernames
                let blocked = ['admin','root','webmaster','test','null'];
                const lowercaseUsername = String(username).toLowerCase();
                if (blocked.includes(lowercaseUsername)){
                    throw new Error("Unallowed username");
                }
                
                await this.createAccount(lowercaseUsername, validatedDisplayName, trimmedEmail, password, "[]", emailVerified);
                
                // Send verification email if a real email was provided
                if (emailVerified === 0 && trimmedEmail && !trimmedEmail.endsWith('@auth.austinsdk.me')) {
                    try {
                        const Email = require('./email');
                        const emailService = new Email();
                        
                        // Get the newly created user's ID
                        const newUser = this.db.prepare("SELECT id FROM users WHERE username = ?").get(lowercaseUsername);
                        
                        if (newUser) {
                            await emailService.sendVerificationEmail(trimmedEmail, {
                                subject: 'Verify Your Email Address',
                                purpose: 'verify_email',
                                userId: newUser.id,
                                username: lowercaseUsername,
                                meta: {
                                    action: 'registration',
                                    timestamp: new Date().toISOString()
                                },
                                useTemplate: true
                            });
                            console.log(`Verification email sent to ${trimmedEmail} for new user ${newUser.id}`);
                        }
                    } catch (emailError) {
                        console.error('Error sending verification email during registration:', emailError);
                        // Don't fail registration if email sending fails
                    }
                }
                
                return res.status(201).json({
                    message: "Created user account successfully!"
                });
            } catch (e) {
                return res.status(400).json({
                    message: e.message || String(e)
                });
            }
        })
        this.router.post("/logout", async (req,res)=>{
            try {
                const { tokenId } = req.body;
                
                if (!tokenId) {
                    return res.status(400).json({ message: "Token ID is required" });
                }

                // Verify user is authenticated
                if (!req.user) {
                    return res.status(401).json({ message: "Unauthorized" });
                }

                // Get the token to verify ownership or admin privileges
                const tokenRecord = this.db.prepare("SELECT * FROM tokens WHERE id = ?").get(tokenId);
                if (!tokenRecord) {
                    return res.status(404).json({ message: "Token not found" });
                }

                // Check if user owns the token or is an admin
                const userPermissions = req.user.permissions || [];
                if (tokenRecord.uuid !== req.user.id && !userPermissions.includes('admin')) {
                    return res.status(403).json({ message: "Permission denied" });
                }

                // Delete the token
                this.logoutToken(tokenId);
                
                res.json({ message: "Token logged out successfully" });
            } catch (error) {
                console.error("Logout error:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        })
    }
    getProjectFromId(id){
        return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id)
    }
    createAccount = async (username, display_name, email, password, perms="[]", email_verified=0) => {
        if (!username || !password || !perms){
            console.error(`error auth.js... username ${!!username} display_name ${!!display_name} email ${!!email} password ${!!password} perms ${!!perms}`)
            return process.exit(1)
        }
        
        // If display_name is empty, use username as default
        if (!display_name || display_name.trim() === '') {
            display_name = username;
        }
        
        try {
            const existingUser = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
            if (existingUser) {
                throw new Error("Account already exists");
            }

            // hash password and insert new user
            const hashedPassword = await hash(password);
            return this.db.prepare("INSERT INTO users (username, password, email, permissions, display_name, email_verified) VALUES (?, ?, ?, ?, ?, ?)").run(username, hashedPassword, email || null, perms, display_name, email_verified);
        } catch (error) {
            if (error.message === "Account already exists") {
                throw error;
            }
            console.error("Database error in createAccount:", error);
            throw new Error("Failed to create account");
        }
    }

    getUserPermissions(uuid){
        let _users = users;
        let user;
        
        // Check if user is already cached
        if (_users[String(uuid)]) {
            user = _users[String(uuid)];
        } else {
            user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(uuid);
            if (user) {
                users[String(user.id)] = user;
            }
        }
        
        if (!user) {
            return [];
        }
        
        try {
            if (!user.permissions) {
                return [];
            } else if (Array.isArray(user.permissions)) {
                return user.permissions;
            } else if (typeof user.permissions === 'string') {
                if (user.permissions.trim() === '') {
                    return [];
                } else {
                    return JSON.parse(user.permissions);
                }
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error parsing user permissions:', error);
            console.error('Problematic permissions value:', user.permissions);
            console.error('Permissions type:', typeof user.permissions);
            return [];
        }
    }
    deleteProject(id){
        // Check if project exists before deletion
        const existingProject = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
        if (!existingProject) {
            throw new Error("Project not found");
        }
        
        let x = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id)
        _projects_chached = false; // Clear cache when project is deleted
        return x
    }
    createProject(name, description, link, permissions) {
        // Validate project name
        if (!name || !name.trim()) {
            throw new Error("Project name is required");
        }
        
        // Check if project with same name already exists
        const existingProject = this.db.prepare("SELECT * FROM projects WHERE name = ?").get(name.trim());
        if (existingProject) {
            throw new Error("Project with this name already exists");
        }
        
        // Convert permissions array to JSON string
        const permissionsJson = JSON.stringify(permissions || []);
        
        // Insert new project
        const result = this.db.prepare("INSERT INTO projects (name, description, link, permissions) VALUES (?, ?, ?, ?)").run(
            name.trim(),
            description || "",
            link || "/",
            permissionsJson
        );
        
        // Clear projects cache to force refresh
        _projects_chached = false;
        
        return result;
    }

    updateProject(id, name, description, link, permissions) {
        // Validate project ID
        if (!id) {
            throw new Error("Project ID is required");
        }
        
        // Validate project name
        if (!name || !name.trim()) {
            throw new Error("Project name is required");
        }
        
        // Check if project exists
        const existingProject = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
        if (!existingProject) {
            throw new Error("Project not found");
        }
        
        // Check if another project with same name already exists (excluding current project)
        const duplicateProject = this.db.prepare("SELECT * FROM projects WHERE name = ? AND id != ?").get(name.trim(), id);
        if (duplicateProject) {
            throw new Error("Another project with this name already exists");
        }
        
        // Convert permissions array to JSON string
        const permissionsJson = JSON.stringify(permissions || []);
        
        // Update project
        const result = this.db.prepare("UPDATE projects SET name = ?, description = ?, link = ?, permissions = ? WHERE id = ?").run(
            name.trim(),
            description || "",
            link || "/",
            permissionsJson,
            id
        );
        
        // Clear projects cache to force refresh
        _projects_chached = false;
        
        return result;
    }

    getUserTokens(uuid){
        return this.db.prepare("SELECT * FROM tokens WHERE uuid = ?").all(uuid);
    }
    logoutToken(tokenId){
        return this.db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenId);
    }
    getProjects(permissions){
        let allowedProjects = []

        // cache the projects if not cached
        if (!_projects_chached){
            _projects_chached = true;
            projects = this.db.prepare("SELECT * FROM projects").all();
        }

        // check each project
        let _projects = projects
        for (let i = 0; i<_projects.length; i++){
            let project = _projects[i];

            // check if its just empty
            try {
                if (!project.permissions) {
                    project.permissions = [];
                } else if (Array.isArray(project.permissions)) {
                    // Already an array, use as is
                    project.permissions = project.permissions;
                } else if (typeof project.permissions === 'string') {
                    if (project.permissions.trim() === '') {
                        project.permissions = [];
                    } else {
                        project.permissions = JSON.parse(project.permissions);
                    }
                } else {
                    project.permissions = [];
                }
            } catch (error) {
                console.error('Error parsing project permissions:', error);
                console.error('Problematic permissions value:', project.permissions);
                console.error('Permissions type:', typeof project.permissions);
                project.permissions = [];
            }
            
            if (!project.permissions || project.permissions.length === 0 || permissions.includes("admin")){
                allowedProjects.push(project)
                continue
            }
            let allow = true;
            for (let j = 0; j < project.permissions.length; j++) {
                let permission = project.permissions[j];
                if (!permissions || !permissions.includes(permission)) {
                    allow = false;
                    break;
                }
            }
            if (allow) {
                allowedProjects.push(project);
            }
        }
        return allowedProjects;
    }
    getUserFromToken(token){
        let user = this.db.prepare(`SELECT * FROM tokens WHERE token = ?`).get(token);
        if (!user){
            return false
        }
        let id = user.uuid
        let _users = users
        
        // Check if user is already cached
        if (_users[String(id)]) {
            return _users[String(id)];
        }
        
        let x = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        if (!x){
            return false
        }
        users[String(x.id)] = x;
        return x;
    }

    /**
     * User Permissions Management Methods
     */
    
    // Update a user's permissions
    updateUserPermissions(userId, permissions) {
        if (!Array.isArray(permissions)) {
            throw new Error("Permissions must be an array");
        }
        
        try {
            // Verify user exists before updating
            const existingUser = this.db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
            if (!existingUser) {
                console.error(`Failed to update permissions: User ${userId} not found`);
                throw new Error("User not found");
            }
            
            // Convert permissions array to JSON string
            const permissionsJson = JSON.stringify(permissions);
            
            // Update user permissions in database
            const result = this.db.prepare("UPDATE users SET permissions = ? WHERE id = ?").run(permissionsJson, userId);
            
            // Verify the update was successful
            if (result.changes === 0) {
                console.error(`Failed to update permissions for user ${userId}: No rows affected`);
                throw new Error("Failed to update user permissions: No rows affected");
            }
            
            // Clear user cache to force reload of permissions
            if (users[String(userId)]) {
                delete users[String(userId)];
            }
            
            // Fetch and return the updated user to verify persistence
            const updatedUser = this.db.prepare("SELECT id, username, permissions, created_at FROM users WHERE id = ?").get(userId);
            
            if (!updatedUser) {
                console.error(`Failed to fetch updated user ${userId} after permission update`);
                throw new Error("Failed to verify updated permissions");
            }
            
            // Parse permissions for the response
            let parsedPermissions;
            try {
                parsedPermissions = JSON.parse(updatedUser.permissions);
            } catch (parseError) {
                console.error(`Failed to parse updated permissions for user ${userId}:`, parseError);
                parsedPermissions = [];
            }
            
            console.log(`Successfully updated permissions for user ${userId}: ${JSON.stringify(parsedPermissions)}`);
            
            return { 
                success: true, 
                count: permissions.length, 
                result,
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    permissions: parsedPermissions,
                    created_at: updatedUser.created_at
                }
            };
            
        } catch (error) {
            console.error('Error updating user permissions:', error);
            throw error;
        }
    }

    // Get user by id
    getUserById(userId){
        if (users[String(userId)]){
            return users[String(userId)]
        }
        users[String(userId)] = this.db.prepare("SELECT * FROM  users WHERE id = ?").get(userId)
        return users[String(userId)]
    }

    // Refresh user cache - forces reload from database
    refreshUserCache(userId) {
        // Clear the cached user data
        if (users[String(userId)]) {
            delete users[String(userId)];
        }
        // Fetch fresh data from database
        const freshUser = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        if (freshUser) {
            users[String(userId)] = freshUser;
        }
        return freshUser;
    }

    // Get a specific user's permissions by ID
    getUserPermissionsById(userId) {
        return this.getUserPermissions(userId);
    }

    // Reset user password (admin only)
    async resetUserPassword(userId, newPassword, adminUserId) {
        try {
            // Verify admin permissions
            const adminPermissions = this.getUserPermissions(adminUserId);
            if (!adminPermissions.includes('admin')) {
                throw new Error('Unauthorized: Admin permissions required');
            }

            // Validate the new password
            const { error } = userSchema.validate({
                username: "dummy", // We only care about password validation
                password: newPassword
            });
            
            if (error) {
                throw new Error(error.details[0].message);
            }

            // Check if user exists
            const user = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Hash the new password
            const hashedPassword = await hash(newPassword);

            // Update the password
            const result = this.db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
            
            // Clear user cache
            if (users[String(userId)]) {
                delete users[String(userId)];
            }

            // Log out all tokens for this user for security
            this.db.prepare("DELETE FROM tokens WHERE uuid = ?").run(userId);

            return { success: true, result };
            
        } catch (error) {
            console.error('Error resetting user password:', error);
            throw error;
        }
    }

    // Delete user account (admin only)
    deleteUserAccount(userId, adminUserId) {
        try {
            // Verify admin permissions
            const adminPermissions = this.getUserPermissions(adminUserId);
            if (!adminPermissions.includes('admin')) {
                throw new Error('Unauthorized: Admin permissions required');
            }

            // Check if user exists
            const user = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Don't allow deleting yourself
            if (userId === adminUserId) {
                throw new Error('Cannot delete your own account');
            }

            // Delete all user tokens first
            this.db.prepare("DELETE FROM tokens WHERE uuid = ?").run(userId);

            // Delete the user account
            const result = this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
            
            // Clear user cache
            if (users[String(userId)]) {
                delete users[String(userId)];
            }

            return { success: true, result };
            
        } catch (error) {
            console.error('Error deleting user account:', error);
            throw error;
        }
    }

    /**
     * OAuth Applications Management Methods
     */
    
    // Generate random client ID and secret
    generateClientCredentials() {
        const crypto = require('crypto');
        return {
            client_id: crypto.randomBytes(16).toString('hex'),
            client_secret: crypto.randomBytes(32).toString('hex')
        };
    }

    // Create OAuth application
    createOAuthApplication(name, description, redirect_uris, scopes, userId) {
        try {
            const { client_id, client_secret } = this.generateClientCredentials();
            
            const redirectUrisJson = JSON.stringify(Array.isArray(redirect_uris) ? redirect_uris : [redirect_uris]);
            const scopesJson = JSON.stringify(Array.isArray(scopes) ? scopes : []);
            
            const result = this.db.prepare(
                "INSERT INTO oauth_applications (name, description, client_id, client_secret, redirect_uris, scopes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run(name, description || "", client_id, client_secret, redirectUrisJson, scopesJson, userId);
            
            return { 
                success: true, 
                application: {
                    id: result.lastInsertRowid,
                    name,
                    description,
                    client_id,
                    client_secret,
                    redirect_uris: JSON.parse(redirectUrisJson),
                    scopes: JSON.parse(scopesJson)
                }
            };
        } catch (error) {
            console.error('Error creating OAuth application:', error);
            throw error;
        }
    }

    // Get OAuth applications for user
    getOAuthApplications(userId = null) {
        try {
            let query = "SELECT * FROM oauth_applications";
            let params = [];
            
            if (userId !== null) {
                query += " WHERE user_id = ?";
                params.push(userId);
            }
            
            query += " ORDER BY created_at DESC";
            
            const applications = this.db.prepare(query).all(...params);
            
            return applications.map(app => ({
                ...app,
                redirect_uris: JSON.parse(app.redirect_uris || '[]'),
                scopes: JSON.parse(app.scopes || '[]')
            }));
        } catch (error) {
            console.error('Error getting OAuth applications:', error);
            return [];
        }
    }

    // Get OAuth application by client ID
    getOAuthApplicationByClientId(clientId) {
        try {
            const app = this.db.prepare("SELECT * FROM oauth_applications WHERE client_id = ?").get(clientId);
            if (app) {
                app.redirect_uris = JSON.parse(app.redirect_uris || '[]');
                app.scopes = JSON.parse(app.scopes || '[]');
            }
            return app;
        } catch (error) {
            console.error('Error getting OAuth application by client ID:', error);
            return null;
        }
    }

    // Update OAuth application
    updateOAuthApplication(id, name, description, redirect_uris, scopes, userId) {
        try {
            const redirectUrisJson = JSON.stringify(Array.isArray(redirect_uris) ? redirect_uris : [redirect_uris]);
            const scopesJson = JSON.stringify(Array.isArray(scopes) ? scopes : []);
            
            const result = this.db.prepare(
                "UPDATE oauth_applications SET name = ?, description = ?, redirect_uris = ?, scopes = ? WHERE id = ? AND user_id = ?"
            ).run(name, description || "", redirectUrisJson, scopesJson, id, userId);
            
            return { success: result.changes > 0 };
        } catch (error) {
            console.error('Error updating OAuth application:', error);
            throw error;
        }
    }

    // Delete OAuth application
    deleteOAuthApplication(id, userId) {
        try {
            // First, check if the application exists and belongs to the user
            const app = this.db.prepare("SELECT * FROM oauth_applications WHERE id = ? AND user_id = ?").get(id, userId);
            if (!app) {
                return { success: false, error: "OAuth application not found or unauthorized" };
            }

            // Begin transaction for atomic deletion
            const deleteTransaction = this.db.transaction(() => {
                // Delete related access tokens first
                const deleteTokensResult = this.db.prepare("DELETE FROM oauth_access_tokens WHERE client_id = ?").run(app.client_id);
                
                // Delete related authorization codes
                const deleteCodesResult = this.db.prepare("DELETE FROM oauth_authorization_codes WHERE client_id = ?").run(app.client_id);
                
                // Finally, delete the OAuth application
                const deleteAppResult = this.db.prepare("DELETE FROM oauth_applications WHERE id = ? AND user_id = ?").run(id, userId);
                
                return {
                    tokensDeleted: deleteTokensResult.changes,
                    codesDeleted: deleteCodesResult.changes,
                    appDeleted: deleteAppResult.changes > 0
                };
            });

            const result = deleteTransaction();
            return { 
                success: result.appDeleted,
                tokensDeleted: result.tokensDeleted,
                codesDeleted: result.codesDeleted
            };
        } catch (error) {
            console.error('Error deleting OAuth application:', error);
            throw error;
        }
    }

    // Generate authorization code
    generateAuthorizationCode(clientId, userId, redirectUri, scope) {
        try {
            const crypto = require('crypto');
            const code = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
            
            this.db.prepare(
                "INSERT INTO oauth_authorization_codes (code, client_id, user_id, redirect_uri, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(code, clientId, userId, redirectUri, scope || "", expiresAt);
            
            return code;
        } catch (error) {
            console.error('Error generating authorization code:', error);
            throw error;
        }
    }

    // Exchange authorization code for access token
    exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
        try {
            // Verify authorization code
            const authCode = this.db.prepare(
                "SELECT * FROM oauth_authorization_codes WHERE code = ? AND client_id = ? AND redirect_uri = ?"
            ).get(code, clientId, redirectUri);
            
            if (!authCode) {
                return { success: false, error: "Invalid authorization code" };
            }
            
            // Check if code is expired
            if (new Date() > new Date(authCode.expires_at)) {
                this.db.prepare("DELETE FROM oauth_authorization_codes WHERE code = ?").run(code);
                return { success: false, error: "Authorization code expired" };
            }
            
            // Verify client credentials
            const app = this.getOAuthApplicationByClientId(clientId);
            if (!app || app.client_secret !== clientSecret) {
                return { success: false, error: "Invalid client credentials" };
            }
            
            // Generate access token
            const crypto = require('crypto');
            const accessToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 100 years (effectively permanent)
            
            // Store access token
            this.db.prepare(
                "INSERT INTO oauth_access_tokens (access_token, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)"
            ).run(accessToken, clientId, authCode.user_id, authCode.scope, expiresAt);
            
            // Delete used authorization code
            this.db.prepare("DELETE FROM oauth_authorization_codes WHERE code = ?").run(code);
            
            return {
                success: true,
                access_token: accessToken,
                token_type: "Bearer",
                expires_in: null, // Permanent token
                scope: authCode.scope
            };
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            return { success: false, error: "Internal server error" };
        }
    }

    // Validate access token
    validateAccessToken(accessToken) {
        try {
            const token = this.db.prepare(
                "SELECT * FROM oauth_access_tokens WHERE access_token = ?"
            ).get(accessToken);
            
            if (!token) {
                return { valid: false, error: "Invalid access token" };
            }
            
            if (new Date() > new Date(token.expires_at)) {
                this.db.prepare("DELETE FROM oauth_access_tokens WHERE access_token = ?").run(accessToken);
                return { valid: false, error: "Access token expired" };
            }
            
            return {
                valid: true,
                token: token
            };
        } catch (error) {
            console.error('Error validating access token:', error);
            return { valid: false, error: "Internal server error" };
        }
    }

    // Get connected applications for a user (apps with active access tokens)
    getConnectedApplications(userId) {
        try {
            const connectedApps = this.db.prepare(`
                SELECT DISTINCT 
                    oa.id,
                    oa.name,
                    oa.description,
                    oa.client_id,
                    oa.redirect_uris,
                    oa.scopes,
                    oa.created_at,
                    COUNT(oat.access_token) as active_tokens,
                    MAX(oat.expires_at) as last_expires
                FROM oauth_applications oa
                INNER JOIN oauth_access_tokens oat ON oa.client_id = oat.client_id
                WHERE oat.user_id = ? AND oat.expires_at > datetime('now')
                GROUP BY oa.id, oa.name, oa.description, oa.client_id, oa.redirect_uris, oa.scopes, oa.created_at
                ORDER BY last_expires DESC
            `).all(userId);
            
            return connectedApps.map(app => ({
                ...app,
                redirect_uris: JSON.parse(app.redirect_uris || '[]'),
                scopes: JSON.parse(app.scopes || '[]')
            }));
        } catch (error) {
            console.error('Error getting connected applications:', error);
            return [];
        }
    }

    // Revoke all access tokens for a specific application and user
    revokeApplicationAccess(userId, clientId) {
        try {
            const result = this.db.prepare(
                "DELETE FROM oauth_access_tokens WHERE user_id = ? AND client_id = ?"
            ).run(userId, clientId);
            
            return { success: result.changes > 0, deletedTokens: result.changes };
        } catch (error) {
            console.error('Error revoking application access:', error);
            throw error;
        }
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}