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
        this.db = db
        const router = express.Router();
        router.post("/login",async (req,res)=>{

            const {username,password} = req.body;
            const user = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
            if (!user) return res.status(400).json({ message: "Invalid credentials" });

            const validify = await compare(user.password,password);
            if (!validify) return res.status(400).json({ message: "Invalid credentials" });

            const token = jwt.sign(
                {userId:user.id},
                process.env.JWT_SECRET || "qsd90!h3l2$!@asdn1p9dfn12h*#asdnj2"
            )

            console.log(token);
        })
    }
    createAccount = async (username, password) => {
        const existingUser = this.db.prepare("SELECT * FROM users WHERE username LIKE ?").get(username);
        console.log(existingUser);
        if (existingUser) {
            throw new Error("Account already exists");
        }

        // hash password and insert new user
        const hashedPassword = await hash(password);
        return this.db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
    }
}

module.exports = (express,db)=>{
    return new mhm(express,db)
}