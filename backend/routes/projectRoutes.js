const express = require("express");
const router = express.Router();
const multer = require("multer");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const auth = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB per file

// GET /projects
router.get("/", async (req, res) => {
  try {
    const { search, tag, status, domain } = req.query;
    const query = {};
    if (search) query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
    if (tag)    query.tags = { $in: [tag] };
    if (status) query.status = status;
    if (domain) query.domain = domain;

    // Exclude projects from private users
    const User = require("../models/User");
    const privateUsers = await User.find({ isPrivate: true }).select("_id");
    const privateIds = privateUsers.map(u => u._id);
    if (privateIds.length) query.userId = { $nin: privateIds };

    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "username avatar")
      .populate("remixedFrom", "title userId");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects
router.post("/", auth, upload.array("files", 10000), async (req, res) => {
  try {
    const { title, description, codeSnippet, tags, status, domain, features, howItWorks, futurePlans } = req.body;
    // Support folder uploads — use relativePath if available (sent from frontend via formData field)
    const files = (req.files || []).map((f, i) => {
      const relPaths = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : [];
      return { name: relPaths[i] || f.originalname, path: f.filename, size: f.size };
    });

    const project = await Project.create({
      title, description, codeSnippet,
      tags: tags ? JSON.parse(tags) : [],
      status: status || "idea",
      domain: domain || "",
      about: { features: features || "", howItWorks: howItWorks || "", futurePlans: futurePlans || "" },
      files,
      userId: req.user.id
    });

    await Activity.create({ userId: req.user.id, type: "created", projectId: project._id });
    const populated = await project.populate("userId", "username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── All specific /:id/sub-routes MUST come before GET /:id ──

// POST /projects/:id/remix
router.post("/:id/remix", auth, async (req, res) => {
  try {
    const original = await Project.findById(req.params.id);
    if (!original) return res.status(404).json({ message: "Project not found" });
    const isOwner = original.userId.toString() === req.user.id;
    
    // Check if remixing is allowed:
    // 1. If it's public, anyone can remix.
    // 2. If it's not public, only owner or explicitly allowed users can remix.
    const isAllowed = original.isPublicRemix || isOwner || original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
    
    if (!isAllowed) {
      return res.status(403).json({ message: "This project is private. You must request access from the creator to branch it." });
    }

    const remixed = await Project.create({
      title: `${original.title} (Remix)`,
      description: original.description,
      codeSnippet: original.codeSnippet,
      tags: original.tags,
      domain: original.domain,
      status: "in-progress",
      about: original.about,
      files: original.files,
      userId: req.user.id,
      remixedFrom: original._id
    });

    original.remixCount = (original.remixCount || 0) + 1;
    await original.save();

    await Activity.create({
      userId: req.user.id,
      type: "remixed",
      projectId: remixed._id,
      targetId: original._id,
      meta: original.title
    });

    const populated = await remixed.populate("userId", "username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/pull - Pull latest updates from original project into the remix
router.post("/:id/pull", auth, async (req, res) => {
  try {
    const remix = await Project.findById(req.params.id);
    if (!remix) return res.status(404).json({ message: "Project not found" });

    if (remix.userId?.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized to pull into this project" });

    if (!remix.remixedFrom)
      return res.status(400).json({ message: "This project is not a remix. Cannot pull." });

    const original = await Project.findById(remix.remixedFrom);
    if (!original)
      return res.status(404).json({ message: "Original project no longer exists." });

    // Security check: Make sure user is either the owner, an allowed remixer, or the project is public
    const isOwner = original.userId.toString() === req.user.id;
    const isAllowed = original.isPublicRemix || isOwner || original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
    
    if (!isAllowed) {
      return res.status(403).json({ message: "This project is private and you don't have access to pull updates." });
    }

    // Snapshot the remix's current state before overriding
    if (!Array.isArray(remix.versions)) remix.versions = [];
    if (!remix.currentVersion) remix.currentVersion = 1;

    remix.versions.push({
      versionNumber: remix.currentVersion,
      title:         remix.title,
      description:   remix.description,
      codeSnippet:   remix.codeSnippet || "",
      about:         { features: remix.about?.features || "", howItWorks: remix.about?.howItWorks || "", futurePlans: remix.about?.futurePlans || "" },
      status:        remix.status || "idea",
      tags:          remix.tags || [],
      domain:        remix.domain || "",
      editedAt:      new Date()
    });

    // Apply the original's fields but keep the title slightly varied or exactly the original
    remix.title       = `${original.title} (Remix)`;
    remix.description = original.description;
    remix.codeSnippet = original.codeSnippet;
    remix.about       = original.about;
    remix.tags        = original.tags;
    remix.domain      = original.domain;
    remix.currentVersion += 1;
    remix.updatedAt   = new Date();

    await remix.save();

    await Activity.create({
      userId: req.user.id,
      type: "pull_updates", // Custom activity type for pull
      projectId: remix._id,
      targetId: original._id,
      meta: original.title
    });

    const populated = await remix.populate("userId", "username avatar").populate("remixedFrom", "title userId");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/like
router.post("/:id/like", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    const userId = req.user.id;
    const alreadyLiked = project.likes.map(id => id.toString()).includes(userId);
    if (alreadyLiked) {
      project.likes = project.likes.filter(id => id.toString() !== userId);
    } else {
      project.likes.push(userId);
      await Activity.create({ userId, type: "liked", projectId: project._id, targetId: project.userId });
    }
    await project.save();
    res.json({ likes: project.likes.length, liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/comments
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    project.comments.push({ userId: req.user.id, text: req.body.text });
    await project.save();
    
    console.log("Creating activity for user", req.user.id, "on project", project._id);
    const act = await Activity.create({ userId: req.user.id, type: "commented", projectId: project._id, targetId: project.userId });
    console.log("Activity created:", act._id);
    
    // We do NOT use Activity for comments to avoid spam.
    await project.populate("comments.userId", "username avatar");
    res.json(project.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/comments/:commentId/like
router.post("/:id/comments/:commentId/like", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    
    const comment = project.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userId = req.user.id;
    const alreadyLiked = comment.likes?.map(id => id.toString()).includes(userId);

    if (alreadyLiked) {
      comment.likes = comment.likes.filter(id => id.toString() !== userId);
    } else {
      if (!Array.isArray(comment.likes)) comment.likes = [];
      comment.likes.push(userId);
    }

    await project.save();
    await project.populate("comments.userId", "username avatar");
    res.json(project.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id/comments/:commentId
router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    const comment = project.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    comment.deleteOne();
    await project.save();
    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/sync-request — user sends their proposed changes TO the original
router.post("/:id/sync-request", auth, async (req, res) => {
  try {
    console.log("SYNC REQUEST HIT", req.params.id, "by user", req.user.id);
    const original = await Project.findById(req.params.id);
    if (!original) return res.status(404).json({ message: "Project not found" });

    const originalOwnerId = original.userId?.toString();
    if (originalOwnerId === req.user.id)
      return res.status(400).json({ message: "Cannot sync to your own project" });

    // Ensure only allowed remixers can push (security check in case access was revoked)
    const isAllowed = original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
    if (!isAllowed) {
      return res.status(403).json({ message: "Your access to this project has been revoked by the creator." });
    }

    // Check no pending request already exists from this user
    const alreadyPending = (original.syncRequests || []).some(
      r => r.requestedBy.toString() === req.user.id && r.status === "pending"
    );
    if (alreadyPending)
      return res.status(400).json({ message: "You already have a pending sync request" });

    const { summary } = req.body;

    // Find user's remix if it exists, otherwise use their userId as reference
    const remix = await Project.findOne({ remixedFrom: req.params.id, userId: req.user.id });

    if (!Array.isArray(original.syncRequests)) original.syncRequests = [];
    original.syncRequests.push({
      remixId:     remix ? remix._id : null,
      requestedBy: req.user.id,
      summary:     summary || "Syncing changes from branch"
    });
    await original.save();

    await Activity.create({
      userId:    req.user.id,
      type:      "sync_requested",
      projectId: original._id,
      targetId:  original._id,
      meta:      original.title
    });

    res.json({ message: "Sync request sent to the original creator" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /projects/:id/sync-requests — original creator views pending requests
router.get("/:id/sync-requests", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("syncRequests.remixId", "title userId updatedAt description codeSnippet about tags domain")
      .populate("syncRequests.requestedBy", "username avatar");
    if (!project) return res.status(404).json({ message: "Not found" });

    const ownerId = project.userId?._id?.toString() || project.userId?.toString();
    if (ownerId !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const pending = (project.syncRequests || []).filter(r => r.status === "pending");
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/sync-request/:reqId/respond — approve copies remix changes INTO original
router.post("/:id/sync-request/:reqId/respond", auth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!["approve", "decline"].includes(action))
      return res.status(400).json({ message: "action must be approve or decline" });

    const original = await Project.findById(req.params.id);
    if (!original) return res.status(404).json({ message: "Not found" });

    const ownerId = original.userId?._id?.toString() || original.userId?.toString();
    if (ownerId !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const syncReq = original.syncRequests?.id(req.params.reqId);
    if (!syncReq) return res.status(404).json({ message: "Sync request not found" });
    if (syncReq.status !== "pending")
      return res.status(400).json({ message: "Request already responded to" });

    syncReq.status = action === "approve" ? "approved" : "declined";

    if (action === "approve") {
      // Get the source of changes: remix if exists, otherwise find any project by the requester
      let source = syncReq.remixId ? await Project.findById(syncReq.remixId) : null;
      if (!source) {
        // Fall back to the most recently updated project by the requester
        source = await Project.findOne({ userId: syncReq.requestedBy }).sort({ updatedAt: -1 });
      }

      if (source) {
        if (!Array.isArray(original.versions)) original.versions = [];
        if (!original.currentVersion) original.currentVersion = 1;

        // Snapshot original's current state first
        original.versions.push({
          versionNumber: original.currentVersion,
          title:         original.title,
          description:   original.description,
          codeSnippet:   original.codeSnippet || "",
          about:         { features: original.about?.features || "", howItWorks: original.about?.howItWorks || "", futurePlans: original.about?.futurePlans || "" },
          status:        original.status || "idea",
          tags:          original.tags || [],
          domain:        original.domain || "",
          editedAt:      original.updatedAt || original.createdAt
        });

        // Apply source's content to original
        original.title       = source.title.replace(" (Remix)", "").trim();
        original.description = source.description;
        original.codeSnippet = source.codeSnippet;
        original.about       = source.about;
        original.tags        = source.tags;
        original.domain      = source.domain;
        original.currentVersion += 1;
        original.updatedAt   = new Date();

        if (!Array.isArray(original.syncHistory)) original.syncHistory = [];
        original.syncHistory.push({
          remixId: syncReq.remixId,
          contributorId: syncReq.requestedBy,
          versionNumber: original.currentVersion,
          approvedAt: new Date()
        });
      }

      await Activity.create({
        userId: req.user.id,
        type: "sync_approved",
        projectId: original._id,
        targetId: syncReq.remixId,
        meta: original.title
      });
    }

    await original.save();
    res.json({ message: action === "approve" ? "Sync approved — original project updated with remix changes" : "Sync declined" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Access Control Routes ──

// POST /projects/:id/req-access
router.post("/:id/req-access", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    
    if (project.userId.toString() === req.user.id)
      return res.status(400).json({ message: "You are the owner" });

    // Check if already allowed
    if (project.allowedRemixers?.some(uid => uid.toString() === req.user.id))
      return res.status(400).json({ message: "You already have access" });

    // Check if pending request exists
    const hasPending = project.remixAccessRequests?.some(r => r.userId.toString() === req.user.id && r.status === "pending");
    if (hasPending)
      return res.status(400).json({ message: "Request already pending" });

    if (!Array.isArray(project.remixAccessRequests)) project.remixAccessRequests = [];
    project.remixAccessRequests.push({ userId: req.user.id });
    
    await project.save();
    
    // Create activity for the owner
    const Activity = require("../models/Activity");
    await Activity.create({
      userId: req.user.id,
      type: "remix_requested",
      projectId: project._id,
      targetId: project.userId,
      meta: project.title
    });

    // Populate and return updated requests so UI can update correctly
    await project.populate("remixAccessRequests.userId", "username avatar");
    res.json({ message: "Access requested successfully", remixAccessRequests: project.remixAccessRequests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/req-access/:reqId/respond
router.post("/:id/req-access/:reqId/respond", auth, async (req, res) => {
  try {
    const { action } = req.body; // "approve" or "decline"
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    if (project.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const reqItem = project.remixAccessRequests?.id(req.params.reqId);
    if (!reqItem || reqItem.status !== "pending")
      return res.status(400).json({ message: "Invalid or already handled request" });

    reqItem.status = action === "approve" ? "approved" : "declined";

    if (action === "approve") {
      if (!Array.isArray(project.allowedRemixers)) project.allowedRemixers = [];
      if (!project.allowedRemixers.includes(reqItem.userId)) {
        project.allowedRemixers.push(reqItem.userId);
      }
    }

    await project.save();
    await project.populate("remixAccessRequests.userId", "username avatar");
    await project.populate("allowedRemixers", "username avatar");
    
    res.json({
      message: action === "approve" ? "Access granted" : "Access declined",
      remixAccessRequests: project.remixAccessRequests,
      allowedRemixers: project.allowedRemixers
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id/revoke-access/:userId
router.delete("/:id/revoke-access/:userId", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    if (project.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    project.allowedRemixers = project.allowedRemixers?.filter(uid => uid.toString() !== req.params.userId) || [];
    await project.save();
    
    await project.populate("allowedRemixers", "username avatar");
    res.json({ message: "Access revoked", allowedRemixers: project.allowedRemixers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/toggle-public-remix
router.post("/:id/toggle-public-remix", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    if (project.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    project.isPublicRemix = !project.isPublicRemix;
    await project.save();
    res.json({ isPublicRemix: project.isPublicRemix, message: `Remixing is now ${project.isPublicRemix ? "Public" : "Private (Request Only)"}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── File Content Editing (IDE) ──

// GET /projects/:id/files/:fileIndex/content
router.get("/:id/files/:fileIndex/content", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    const file = project.files[req.params.fileIndex];
    if (!file) return res.status(404).json({ message: "File not found" });

    const filePath = path.join(__dirname, "..", "uploads", file.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing on server" });

    // Ensure it's not a binary file roughly (e.g. image/zip)
    const ext = path.extname(file.name).toLowerCase();
    const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".pdf", ".mp4", ".mp3"].includes(ext);
    if (isBinary) return res.status(400).json({ message: "Cannot edit binary files" });

    const content = fs.readFileSync(filePath, "utf8");
    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /projects/:id/files/:fileIndex/content
router.put("/:id/files/:fileIndex/content", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    if (project.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const file = project.files[req.params.fileIndex];
    if (!file) return res.status(404).json({ message: "File not found" });

    const filePath = path.join(__dirname, "..", "uploads", file.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing on server" });

    fs.writeFileSync(filePath, req.body.content, "utf8");
    
    project.updatedAt = new Date();
    await project.save();

    res.json({ message: "File updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Generic /:id routes LAST ──

// GET /projects/:id
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("userId", "username avatar followers")
      .populate("comments.userId", "username avatar")
      .populate("remixedFrom", "title userId")
      .populate("syncHistory.contributorId", "username avatar")
      .populate("remixAccessRequests.userId", "username avatar")
      .populate("syncRequests.requestedBy", "username avatar")
      .populate("syncRequests.remixId", "title")
      .populate("allowedRemixers", "username avatar");
    if (!project) return res.status(404).json({ message: "Not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /projects/:id
router.put("/:id", auth, upload.array("files", 10), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });

    const ownerId = project.userId?._id?.toString() || project.userId?.toString();
    if (ownerId !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    if (!Array.isArray(project.versions)) project.versions = [];
    if (!project.currentVersion) project.currentVersion = 1;

    project.versions.push({
      versionNumber: project.currentVersion,
      title:         project.title,
      description:   project.description,
      codeSnippet:   project.codeSnippet || "",
      about:         { features: project.about?.features || "", howItWorks: project.about?.howItWorks || "", futurePlans: project.about?.futurePlans || "" },
      status:        project.status  || "idea",
      tags:          project.tags    || [],
      domain:        project.domain  || "",
      editedAt:      project.updatedAt || project.createdAt
    });

    const { title, description, codeSnippet, tags, status, domain, features, howItWorks, futurePlans } = req.body;
    const newFiles = (req.files || []).map(f => ({ name: f.originalname, path: f.filename, size: f.size }));

    if (title)       project.title       = title;
    if (description) project.description = description;
    if (codeSnippet !== undefined) project.codeSnippet = codeSnippet;
    if (status)      project.status      = status;
    if (domain !== undefined) project.domain = domain;
    if (tags)        project.tags        = JSON.parse(tags);
    project.about = {
      features:    features    !== undefined ? features    : (project.about?.features    || ""),
      howItWorks:  howItWorks  !== undefined ? howItWorks  : (project.about?.howItWorks  || ""),
      futurePlans: futurePlans !== undefined ? futurePlans : (project.about?.futurePlans || "")
    };
    if (newFiles.length > 0) project.files = [...(project.files || []), ...newFiles];
    project.currentVersion += 1;
    project.updatedAt = new Date();

    await project.save();
    const populated = await project.populate("userId", "username avatar");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.userId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    await project.deleteOne();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
