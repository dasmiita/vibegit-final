const express = require("express");
const router = express.Router();
const multer = require("multer");
const Idea = require("../models/Idea");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB per file

// GET /ideas
router.get("/", async (req, res) => {
  try {
    const { search, tag, difficulty, visibility } = req.query;
    const query = {};
    if (search) query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
    if (tag) query.tags = { $in: [tag] };
    if (difficulty) query.difficulty = difficulty;
    
    // Visibility logic
    query.visibility = visibility || "public";

    const ideas = await Idea.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "username avatar");
    res.json(ideas);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /ideas
router.post("/", auth, upload.array("files", 10), async (req, res) => {
  try {
    const { title, description, techStack, tags, difficulty, visibility } = req.body;
    const files = (req.files || []).map(f => ({ name: f.originalname, path: f.filename, size: f.size }));

    const idea = await Idea.create({
      title,
      description,
      techStack: techStack ? JSON.parse(techStack) : [],
      tags: tags ? JSON.parse(tags) : [],
      difficulty: difficulty || "all",
      visibility: visibility || "public",
      files,
      userId: req.user.id
    });

    await Activity.create({ userId: req.user.id, type: "created", meta: title });
    const populated = await idea.populate("userId", "username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /ideas/:id
router.put("/:id", auth, upload.array("files", 10), async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    if (idea.userId.toString() !== req.user.id) return res.status(403).json({ message: "Not authorized" });

    const { title, description, techStack, tags, difficulty, visibility } = req.body;
    const newFiles = (req.files || []).map(f => ({ name: f.originalname, path: f.filename, size: f.size }));

    if (title) idea.title = title;
    if (description) idea.description = description;
    if (techStack) idea.techStack = JSON.parse(techStack);
    if (tags) idea.tags = JSON.parse(tags);
    if (difficulty) idea.difficulty = difficulty;
    if (visibility) idea.visibility = visibility;
    if (newFiles.length > 0) idea.files = [...idea.files, ...newFiles];
    idea.updatedAt = new Date();

    await idea.save();
    const populated = await idea.populate("userId", "username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /ideas/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    if (idea.userId.toString() !== req.user.id) return res.status(403).json({ message: "Not authorized" });

    await idea.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Follow idea
router.post("/:id/follow", auth, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    
    const userId = req.user.id;
    const alreadyFollowing = idea.followers.some(id => id.toString() === userId);
    
    if (alreadyFollowing) {
      idea.followers = idea.followers.filter(id => id.toString() !== userId);
    } else {
      idea.followers.push(userId);
    }
    
    await idea.save();
    res.json({ followers: idea.followers.length, following: !alreadyFollowing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Request to contribute
router.post("/:id/request-contribute", auth, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    if (idea.userId.toString() === req.user.id) return res.status(400).json({ message: "Owner cannot request to contribute" });

    const existingReq = idea.contributorRequests.find(r => r.userId.toString() === req.user.id && r.status === "pending");
    if (existingReq) return res.status(400).json({ message: "Request already pending" });

    idea.contributorRequests.push({ userId: req.user.id, message: req.body.message || "" });
    await idea.save();
    res.json({ message: "Contributor request sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Respond to contributor requests
router.post("/:id/contribute-requests/:reqId/respond", auth, async (req, res) => {
  try {
    const { action } = req.body; // "approve" or "decline"
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    if (idea.userId.toString() !== req.user.id) return res.status(403).json({ message: "Not authorized" });

    const reqItem = idea.contributorRequests.id(req.params.reqId);
    if (!reqItem || reqItem.status !== "pending") return res.status(400).json({ message: "Invalid request" });

    reqItem.status = action === "approve" ? "approved" : "declined";
    if (action === "approve") {
      if (!idea.contributors.includes(reqItem.userId)) {
        idea.contributors.push(reqItem.userId);
      }
    }
    await idea.save();
    res.json({ message: `Request ${action}d` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Comment on idea
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });

    idea.comments.push({ userId: req.user.id, text: req.body.text });
    await idea.save();
    
    await idea.populate("comments.userId", "username avatar");
    res.json(idea.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Convert idea to project
router.post("/:id/convert", auth, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: "Not found" });
    if (idea.userId.toString() !== req.user.id) return res.status(403).json({ message: "Not authorized" });

    // Creates a new project from the idea fields
    const project = await Project.create({
      title: idea.title,
      description: idea.description,
      tags: idea.tags,
      files: idea.files,
      status: "idea", 
      userId: req.user.id,
      allowedRemixers: idea.contributors 
    });

    await Activity.create({ userId: req.user.id, type: "created", projectId: project._id, meta: `Converted idea to project: ${project.title}` });
    
    res.json({ message: "Successfully converted to Project", project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single idea
router.get("/:id", async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id)
      .populate("userId", "username avatar")
      .populate("comments.userId", "username avatar")
      .populate("contributors", "username avatar")
      .populate("contributorRequests.userId", "username avatar");
    if (!idea) return res.status(404).json({ message: "Not found" });
    res.json(idea);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
