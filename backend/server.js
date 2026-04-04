const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/ideas",    require("./routes/ideaRoutes"));
app.use("/projects", require("./routes/projectRoutes"));
app.use("/auth",     require("./routes/authRoutes"));
app.use("/users",    require("./routes/userRoutes"));
app.use("/activity", require("./routes/activityRoutes"));
app.use("/messages", require("./routes/messageRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/branches", require("./routes/branchRoutes"));

app.get("/", (req, res) => res.send("API Running 🚀"));

mongoose.connect(process.env.MONGODB_URI, { family: 4 })

.then(() => {
  console.log("MongoDB connected ✅");
  app.listen(5000, () => console.log("Server running on port 5000"));
})
.catch(err => {
  console.error("MongoDB FAILED ❌:", err.message);
  process.exit(1);
});
