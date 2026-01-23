import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Blog",
  password: "",
  port: 5432,
});
db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true}));

let posts = [];

async function loadPosts() {
    console.log("hello");
    const result = await db.query('SELECT * FROM "BlogPosts"');
    console.log(result.rows);
    return result.rows;
}

app.get("/", async (req, res) => {
    try {
       posts = await loadPosts(); 
        
       const result = await db.query('SELECT * FROM "BlogPosts" ORDER BY id DESC');
       res.render("index.ejs", { posts: result.rows });
    } catch (err) {
        console.error("Error loading posts:", err);
        res.render("index.ejs", { posts: [] }); 
    }
});

app.post("/submit", async (req, res) => {
    const { title, content } = req.body;
    
    try {
        await db.query(
            'INSERT INTO "BlogPosts" (title, content) VALUES ($1, $2)', 
            [title, content]
        );
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
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

app.post("/update", async (req, res) => {
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

app.post("/delete", async (req, res) => {
    const idToDelete = req.body.id;

    try {
        await db.query('DELETE FROM "BlogPosts" WHERE id = $1', [idToDelete]);
        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

