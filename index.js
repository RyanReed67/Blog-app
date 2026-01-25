import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Blog",
  password: "Remington102062",
  port: 5432,
});
db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true}));

let posts = [];

async function loadPosts() {
    const result = await db.query('SELECT * FROM "BlogPosts"');
    console.log(result.rows);
    return result.rows;
}

app.get("/", async (req, res) => {
    try {
        const postResult = await db.query(`
            SELECT "BlogPosts".*, authors.name AS author_name,
            COUNT(comments.id) AS comment_count 
            FROM "BlogPosts" 
            LEFT JOIN authors ON "BlogPosts".author_id = authors.id 
            LEFT JOIN comments ON "BlogPosts".id = comments.post_id
            GROUP BY "BlogPosts".id, authors.name
            ORDER BY "BlogPosts".id DESC
        `);

        res.render("index.ejs", { posts: postResult.rows });
    } catch (err) {
        console.error(err);
        res.send("Error");
    }
});

app.post("/submit", async (req, res) => {
    const { title, content, authorName } = req.body;

    try {
        let authorResult = await db.query("SELECT id FROM authors WHERE name = $1", [authorName]);
        let authorId;

        if (authorResult.rows.length > 0) {
            authorId = authorResult.rows[0].id;
        } else {
            const newAuthor = await db.query(
                "INSERT INTO authors (name) VALUES ($1) RETURNING id", 
                [authorName]
            );
            authorId = newAuthor.rows[0].id;
        }
        await db.query(
            'INSERT INTO "BlogPosts" (title, content, author_id) VALUES ($1, $2, $3)',
            [title, content, authorId]
        );

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
            authors.name AS author_name,
            (CASE 
            WHEN title ILIKE $1 THEN 2
            WHEN content ILIKE $1 THEN 1
            ELSE 0
            END) AS search_rank
            FROM "BlogPosts"
            LEFT JOIN authors ON "BlogPosts".author_id = authors.id
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

app.get("/post/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const result = await db.query(`
            SELECT "BlogPosts".*, authors.name AS author_name
            FROM "BlogPosts"
            LEFT JOIN authors ON "BlogPosts".author_id = authors.id
            WHERE "BlogPosts".id = $1
            `, [id]
            );
            const commentsResult = await db.query(`
                SELECT * FROM comments WHERE post_id = $1 ORDER BY id DESC`,
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
            'INSERT INTO comments (post_id, author_name, comment_text) VALUES ($1, $2, $3)',
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
            'SELECT * FROM authors WHERE id = $1',
            [authorId]
        );

        const postsResults = await db.query(
            `SELECT "BlogPosts".*, authors.name AS author_name
            FROM "BlogPosts"
            JOIN authors ON "BlogPosts".author_id = authors.id
            WHERE authors.id = $1
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

