import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
// import sql from "./db.js";

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
    console.log("hello");
    const result = await db.query('SELECT * FROM "BlogPosts"');
    console.log(result.rows);
    return result.rows;
}

app.get("/", (req, res) => {
    
    posts = loadPosts();
    console.log(posts);
    res.render("index.ejs", {posts: posts});
});

app.post("/submit", (req, res) => {
    const {title, content} = req.body;
    const date = new Date().toLocaleString();
    posts.push({
        title,
        content,
        date: date
    });
    // sql `INSERT into "BlogPosts" (title, content, date) values (${title}, ${content}, ${date})`
    res.redirect("/");
});

app.get("/edit/:index", (req, res) => {
    const index = req.params.index;
    const postToEdit = posts[index];
    if (postToEdit) {
        res.render("edit.ejs", {
            post: postToEdit,
            index: index
        });
    } else {
        res.redirect("/");
    }
});

app.post("/update", (req, res) => {
    const {index, title, content} = req.body;
    posts[index] = {title, content};
    res.redirect("/");
});

app.post("/delete", (req, res) => {
    const index = req.body.index;
    posts.splice(index, 1);
    res.redirect("/");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
