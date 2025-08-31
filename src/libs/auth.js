const jwt = require("jsonwebtoken");
const argon2 = require("argon2");

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

let users = []
class mhm{
    constructor(express,db){
        this.db = db;
        this.router = express.Router();
        this.router.post("/login",async (req,res)=>{

            const {username,password} = req.body;
            const user = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
            if (!user) return res.status(400).json({ message: "Invalid credentials" });

            const validify = await compare(user.password,password);
            if (!validify) return res.status(400).json({ message: "Invalid credentials" });

            const token = jwt.sign(
                {userId:user.id},
                process.env.JWT_SECRET || "qsd90!h3l2$!@asdn1p9dfn12h*#asdnj2"
            )

            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                domain: "." + req.hostname.split('.').slice(-2).join('.'),
                sameSite: "lax",
                path: "/"
            });
            res.json({ message: "Login successful" });
        })
        this.router.post("/register",async (req,res)=>{

            const {username,password} = req.body;

            try{
                let x = await this.createAccount(username,password)
            } catch (e){
                return res.status(400).json({
                    message:e
                })
            }
            return res.status(201).json({
                message: "Created user account successfully!"
            })
        })
    }

    createAccount = async (username, password, perms="[]") => {
        let blocked = ['admin','root','webmaster','test','null'];
        username = String(username).toLowerCase()
        if (blocked.includes(username)){
            throw new Error("Unallowed username");
        }
        const existingUser = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
        if (existingUser) {
            throw new Error("Account already exists");
        }

        // hash password and insert new user
        const hashedPassword = await hash(password);
        return this.db.prepare("INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)").run(username, hashedPassword,perms);
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}