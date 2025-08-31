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
        .pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*]{8,30}$'))
        .required()
        .messages({
            'string.pattern.base': 'Password must be between 8-30 characters and can contain letters, numbers, and special characters (!@#$%^&*)'
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
    }

    createAccount = async (username, password, perms="[]") => {
        const existingUser = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
        if (existingUser) {
            throw new Error("Account already exists");
        }

        // hash password and insert new user
        const hashedPassword = await hash(password);
        return this.db.prepare("INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)").run(username, hashedPassword,perms);
    }
    getUserPermissions(uuid) {
        let user = users[String(uuid)];
        if (!user) {
            user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(uuid);
            if (user) users[String(user.id)] = user;
        }
        if (!user || !user.permissions) return [];
        try {
            return typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
        } catch (e) {
            return [];
        }
    }
    deleteProject(id){
        console.log(id)
        let x = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id)
        projects = this.db.prepare("SELECT * FROM projects")
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
    getProjects(permissions) {
        let allowedProjects = [];
        let projectsList = this.db.prepare("SELECT * FROM projects").all();
        for (let i = 0; i < projectsList.length; i++) {
            let project = projectsList[i];
            try {
                project.permissions = typeof project.permissions === 'string' ? JSON.parse(project.permissions) : project.permissions;
            } catch (e) {
                project.permissions = [];
            }
            if (!project.permissions || project.permissions.length === 0 || (permissions && permissions.includes("admin"))) {
                allowedProjects.push(project);
                continue;
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
    getUserFromToken(token) {
        let tokenRow = this.db.prepare(`SELECT * FROM tokens WHERE token = ?`).get(token);
        if (!tokenRow) {
            return false;
        }
        let id = tokenRow.uuid;
        let user = users[String(id)];
        if (user) return user;
        let dbUser = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        if (!dbUser) {
            return false;
        }
        users[String(dbUser.id)] = dbUser;
        return dbUser;
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}