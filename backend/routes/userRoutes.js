const express = require("express");
const router = express.Router();
const multer = require("multer");
const User = require("../models/User");
const Project = require("../models/Project");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");

const Activity = require("../models/Activity");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /users/suggestions — Find users to follow
router.get("/suggestions", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("following");
    const followingIds = me.following || [];
    
    // Find users who are NOT me and NOT already followed
    const suggestions = await User.find({
      _id: { $ne: req.user.id, $nin: followingIds },
      isPrivate: { $ne: true }
    })
    .select("username avatar bio")
    .limit(6);

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /users/search?q=... — MUST be before /:id
router.get("/search", optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ users: [], projects: [] });

    let followingIds = new Set();
    if (req.user?.id) {
      const me = await User.findById(req.user.id).select("following");
      if (me?.following?.length)
        followingIds = new Set(me.following.map(id => id.toString()));
    }

    const [userDocs, projects] = await Promise.all([
      User.find({ username: { $regex: q, $options: "i" }, isPrivate: { $ne: true } })
        .select("username avatar")
        .limit(5),
      Project.find({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } }
        ]
      })
        .select("title description userId likes comments createdAt")
        .populate("userId", "username isPrivate avatar")
        .limit(10)
    ]);

    // To fulfill "find the username and its project", we also search for projects where the author's username matches q
    const authorProjects = await Project.find()
      .populate({
        path: 'userId',
        match: { username: { $regex: q, $options: "i" }, isPrivate: { $ne: true } },
        select: 'username avatar isPrivate'
      })
      .select("title description userId likes comments createdAt")
      .limit(10);

    // Filter out results where the userId didn't match the populate match condition
    const searchByAuthor = authorProjects.filter(p => p.userId !== null);

    // Merge and deduplicate projects
    const allProjects = [...projects];
    searchByAuthor.forEach(ap => {
      if (!allProjects.some(p => p._id.toString() === ap._id.toString())) {
        allProjects.push(ap);
      }
    });

    const users = userDocs.map(u => ({
      _id: u._id,
      username: u.username,
      avatar: u.avatar,
      isFollowing: followingIds.has(u._id.toString())
    }));

    const publicProjects = allProjects.filter(p => !p.userId?.isPrivate);
    res.json({ users, projects: publicProjects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const projectCount = await Project.countDocuments({ userId: req.params.id });
    res.json({ ...user.toObject(), projectCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /users/:id/projects
router.get("/:id/projects", async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .populate("userId", "username avatar");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /users/:id — edit profile (auth required, own profile only)
router.put("/:id", auth, upload.single("avatar"), async (req, res) => {
  try {
    if (req.params.id !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const { bio, skills, accentColor, isPrivate } = req.body;
    const updates = {
      bio: bio || "",
      skills: skills ? JSON.parse(skills) : [],
      accentColor: accentColor || "",
      isPrivate: isPrivate === "true" || isPrivate === true
    };
    if (req.file) updates.avatar = req.file.filename;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /users/:id/follow
router.post("/:id/follow", auth, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Cannot follow yourself" });

    const target = await User.findById(req.params.id);
    const me = await User.findById(req.user.id);
    if (!target || !me) return res.status(404).json({ message: "User not found" });

    const isFollowing = me.following.map(id => id.toString()).includes(req.params.id);
    if (isFollowing) {
      me.following = me.following.filter(id => id.toString() !== req.params.id);
      target.followers = target.followers.filter(id => id.toString() !== req.user.id);
    } else {
      me.following.push(req.params.id);
      target.followers.push(req.user.id);
    }

    await me.save();
    await target.save();
    if (!isFollowing) {
      await Activity.create({ userId: req.user.id, type: "followed", targetId: req.params.id });
    }
    res.json({ following: !isFollowing, followerCount: target.followers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
