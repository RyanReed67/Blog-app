import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import env from "dotenv";
import multer from "multer";

env.config(); 
const app = express();
const port = 3000;
const saltRounds = 10;
const upload = multer({ dest: 'public/uploads/' });

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } 
}));

app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); 
    }
    res.redirect("/"); 
}

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true}));

let posts = [];

async function loadPosts() {
    const result = await db.query('SELECT * FROM "BlogPosts"');
    console.log(result.rows);
    return result.rows;
}

app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    try {
        const checkResult = await db.query('SELECT * FROM "Users" WHERE email = $1', [email]);
        if (checkResult.rows.length > 0) {
            res.send("Email already exists. Try logging in.");
        } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) console.error(err);
                const result = await db.query(
                    'INSERT INTO "Users" (email, password) VALUES ($1, $2) RETURNING *',
                    [email, hash]
                );
                const user = result.rows[0];
                req.login(user, (err) => {
                    res.redirect("/");
                });
            });
        }
    } catch (err) { console.error(err); }
});

passport.use(new Strategy(async (username, password, cb) => {
    try {
        const result = await db.query('SELECT * FROM "Users" WHERE email = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const storedHash = user.password;
            bcrypt.compare(password, storedHash, (err, isMatch) => {
                if (err){
                    return cb(err);
                } else if (isMatch) {
                    return cb(null, user);
                } else {
                    return cb(null, false);
                }
            });
        } else {
            return cb("User not found");
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}));

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

app.get("/", async (req, res) => {
    try {
        const postResult = await db.query(`
            SELECT "BlogPosts".*, "Authors".name AS author_name,
            COUNT("Comments".id) AS comment_count,
                (CASE
                WHEN "BlogPosts".date > NOW() - INTERVAL '24 hours' THEN 'TRUE'
                ELSE 'False'
                END) AS is_new 
            FROM "BlogPosts" 
            LEFT JOIN "Authors" ON "BlogPosts".author_id = "Authors".id 
            LEFT JOIN "Comments" ON "BlogPosts".id = "Comments".post_id
            GROUP BY "BlogPosts".id, "Authors".name
            ORDER BY "BlogPosts".id DESC
        `);

        res.render("index.ejs", { 
            posts: postResult.rows,
            user: req.user || null
        });
    } catch (err) {
        console.error(err);
        res.send("Error");
    }
});

app.post("/submit", ensureAuthenticated, upload.single('image'), async (req, res) => {
    const { title, content, authorName, tags } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        let authorResult = await db.query("SELECT id FROM \"Authors\" WHERE name = $1", [authorName]);
        let authorId;

        if (authorResult.rows.length > 0) {
            authorId = authorResult.rows[0].id;
        } else {
            const newAuthor = await db.query(
                "INSERT INTO \"Authors\"(name) VALUES ($1) RETURNING id", 
                [authorName]
            );
            authorId = newAuthor.rows[0].id;
        }
        await db.query(
            'INSERT INTO "BlogPosts" (title, content, author_id, image_path) VALUES ($1, $2, $3, $4)',
            [title, content, authorId, imagePath]
        );
        if (Array.isArray(tags)) {
            let tagResult = await db.query(`
                INSERT INTO "Tags" (name) VALUES ($1) 
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [tagName]);
            let tagId = tagResult.rows[0].id;
            await db.query('INSERT INTO "Post_Tags" (post_id, tag_id) VALUES ($1, $2)', [postid, tagId]);
         }

        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.send("Error submitting post.");
    }
});

app.get("/search", async (req, res) => {
    const searchTerm = req.query.query;

    try {
        const result = await db.query(`
            SELECT
            "BlogPosts".*,
            "Authors".name AS author_name,
            (CASE 
            WHEN title ILIKE $1 THEN 2
            WHEN content ILIKE $1 THEN 1
            ELSE 0
            END) AS search_rank
            FROM "BlogPosts"
            LEFT JOIN "Authors" ON "BlogPosts".author_id = "Authors".id
            WHERE title ILIKE $1 OR content ILIKE $1
            ORDER BY search_rank, "BlogPosts".id DESC
            `, 
            [`%${searchTerm}%`]
        );
            res.render("index.ejs", {
                posts: result.rows,
                searchQuery: searchTerm
            });
    } catch (err) {
        console.error(err);
    };
});

app.get("/edit/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.query('SELECT * FROM "BlogPosts" WHERE id = $1', [id]);
        const postToEdit = result.rows[0];

        if (postToEdit) {
            res.render("edit.ejs", {
                post: postToEdit
            });
        } else {
            res.redirect("/");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.post("/update", ensureAuthenticated, async (req, res) => {
    const { id, title, content } = req.body;

    try {
        await db.query(
            'UPDATE "BlogPosts" SET title = $1, content = $2 WHERE id = $3',
            [title, content, id]
        );
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.post("/delete", ensureAuthenticated, async (req, res) => {
    const idToDelete = req.body.id;

    try {
        await db.query('DELETE FROM "BlogPosts" WHERE id = $1', [idToDelete]);
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.get("/post/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const result = await db.query(`
            SELECT "BlogPosts".*, "Authors".name AS author_name
            FROM "BlogPosts"
            LEFT JOIN "Authors" ON "BlogPosts".author_id = "Authors".id
            WHERE "BlogPosts".id = $1
            `, [id]
            );
            const commentsResult = await db.query(`
                SELECT * FROM "Comments" WHERE post_id = $1 ORDER BY id DESC`,
                [id]
            );
        const post = result.rows[0];
        if (post) {
            res.render("post.ejs", { 
                post: post,
                comments: commentsResult.rows 
            });
        } else {
            res.redirect("/");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.post("/comment", async (req, res) => {
    const { postId, authorName, commentComment } = req.body;
    try {
        await db.query(
            'INSERT INTO "Comments" (post_id, author_name, comment_text) VALUES ($1, $2, $3)',
            [postId, authorName, commentComment]
        );
        res.redirect(`/post/${postId}`); 
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.get("/author/:id", async (req, res) => {
    const authorId = req.params.id;

    try {
        const authorInfo = await db.query(
            'SELECT * FROM "Authors" WHERE id = $1',
            [authorId]
        );

        const postsResults = await db.query(
            `SELECT "BlogPosts".*, "Authors".name AS author_name
            FROM "BlogPosts"
            JOIN "Authors" ON "BlogPosts".author_id = "Authors".id
            WHERE "Authors".id = $1
            ORDER BY "BlogPosts".id DESC`,
            [authorId]
        );

        res.render("author.ejs", {
            authorName: authorInfo.rows[0].name,
            posts: postsResults.rows
        });
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.get("/new", ensureAuthenticated, async (req, res) => {
    res.render("new.ejs", { user: req.user});
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

