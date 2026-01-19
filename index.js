import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

let posts = [];

app.get("/", (req, res) => {
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
    posts.push({title, content});
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

app.listen(port, () =>{
    console.log(`Server is running on port ${port}`);
});
