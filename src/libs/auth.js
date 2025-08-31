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
        this.router.post("/login", limiter, async (req,res)=>{

            const {username,password} = req.body;
            const user = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
            if (!user) return res.status(400).json({ message: "Invalid credentials" });

            const validify = await compare(user.password,password);
            if (!validify) return res.status(400).json({ message: "Invalid credentials" });

            users[String(user.id)]=user;

            const token = jwt.sign(
                {userId:user.id},
                process.env.JWT_SECRET || "qsd90!h3l2$!@asdn1p9dfn12h*#asdnj2"
            )
            this.db.prepare("INSERT INTO tokens (uuid,token) VALUES (?,?)").run(user.id,token)

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                domain: "." + req.hostname.split('.').slice(-2).join('.'),
                sameSite: "lax",
                path: "/"
            });
            res.json({ message: "Login successful" });
        })
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
    getUserPermissions(uuid){
        let _users = users;
        let user;
        for (let i=0;i<_users.length;i++){
            if (uuid == _users[i].id){
                user = _users[i]
                break
            }
        }
        if (!user){
            user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(uuid);
            users[String(user.id)] = user;
        }
        return JSON.parse(user.permissions)
    }
    getProjects(permissions){
        let allowedProjects = []

        // cache the projects if not cached
        // if (!_projects_chached){
        //     _projects_chached = true;
        //     projects = this.db.prepare("SELECT * FROM projects").all();
        // }
        // broken?
        projects = this.db.prepare("SELECT * FROM projects").all();

        // check each project
        let _projects = projects
        for (let i = 0; i<_projects.length; i++){
            let project = _projects[i];

            // check if its just empty
            project.permissions = JSON.parse(project.permissions)
            if (!project.permissions || project.permissions == 0 || permissions.includes("admin")){
                allowedProjects.push(project)
                continue
            }

            // check if u have the propper permissions
            let allow = true;
            for (let i=0;i<project.permissions.length;i++){
                let permission = project.permissions[i]
                if (!permissions.includes(permission)){
                    allow = false;
                    break
                }
            }
            if (allow){
                allowedProjects.push(project)
            }
        }

        // return allowed project
        return allowedProjects
    }
    getUserFromToken(token){
        let user = this.db.prepare(`SELECT * FROM tokens WHERE token = ?`).get(token);
        if (!user){
            return false
        }
        let id = user.uuid
        let _users = users
        for (let i=0;i<_users.length;i++){
            if (id == _users[i].id){
                return _users[i]
            }
        }
        let x = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        if (!x){
            return false
        }
        users[String(x.id)] = x
        return x
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}