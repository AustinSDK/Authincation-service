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
        .required(),
    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'))
        .required()
        .messages({
            'string.pattern.base': 'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)'
        })
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
                const { username, password } = req.body;
                
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

                // Then check blocked usernames
                let blocked = ['admin','root','webmaster','test','null'];
                const lowercaseUsername = String(username).toLowerCase();
                if (blocked.includes(lowercaseUsername)){
                    throw new Error("Unallowed username");
                }
                
                await this.createAccount(lowercaseUsername, password);
                
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
    createAccount = async (username, password, perms="[]") => {
        try {
            const existingUser = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
            if (existingUser) {
                throw new Error("Account already exists");
            }

            // hash password and insert new user
            const hashedPassword = await hash(password);
            return this.db.prepare("INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)").run(username, hashedPassword, perms);
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
            // Convert permissions array to JSON string
            const permissionsJson = JSON.stringify(permissions);
            
            // Update user permissions in database
            const result = this.db.prepare("UPDATE users SET permissions = ? WHERE id = ?").run(permissionsJson, userId);
            
            // Clear user cache to force reload of permissions
            if (users[String(userId)]) {
                delete users[String(userId)];
            }
            
            return { success: true, count: permissions.length, result };
            
        } catch (error) {
            console.error('Error updating user permissions:', error);
            throw new Error("Failed to update user permissions");
        }
    }

    // Get a specific user's permissions by ID
    getUserPermissionsById(userId) {
        return this.getUserPermissions(userId);
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}