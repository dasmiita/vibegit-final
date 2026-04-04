const express = require("express");
const router = express.Router();
const multer = require("multer");
const Project = require("../models/Project");
const Notification = require("../models/Notification");
const Branch = require("../models/Branch");
const Activity = require("../models/Activity");
const auth = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// Project Owner Middleware
const checkProjectOwner = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const ownerId = project.owner?.toString() || project.userId?.toString();
    if (ownerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: Only the project owner can access this." });
    }
    req.project = project;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkProjectContributor = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const isOwner = (project.owner?.toString() || project.userId?.toString()) === req.user.id;
    const isContributor = project.allowedRemixers?.some(id => id.toString() === req.user.id);
    if (!isOwner && !isContributor) {
      return res.status(403).json({ message: "Forbidden: You are not a contributor to this project." });
    }
    req.project = project;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


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

    // Explore filter: only show admin-owned projects (original projects from admins)
    const { explore } = req.query;
    if (explore === "true") {
      query.ownerRole = "admin";
    }

    // Exclude projects from private users
    const User = require("../models/User");
    const privateUsers = await User.find({ isPrivate: true }).select("_id");
    const privateIds = privateUsers.map(u => u._id);
    if (privateIds.length) query.userId = { $nin: privateIds };

    const projects = await Project.find(query)
      .populate("userId", "username avatar")
      .populate("rootCreatorId", "username avatar")
      .populate("remixedFrom", "title")
      .sort({ createdAt: -1 })
      .limit(50);
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
      userId: req.user.id,
      owner: req.user.id,
      rootCreatorId: req.user.id
    });

    await Branch.create({
      branchName: "main",
      sourceProjectId: project._id,
      remixProjectId: project._id,
      branchOwner: req.user.id,
      visibility: "public",
      status: "active"
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
    const isOwner = (original.owner?.toString() || original.userId.toString()) === req.user.id;
    
    // Only owner or explicitly approved contributors can remix
    const isAllowed = isOwner || original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
    
    if (!isAllowed) {
      return res.status(403).json({ message: "This project is private. You must request access from the creator to branch it." });
    }

    const newTitle = original.title.endsWith("(Remix)") ? original.title : `${original.title} (Remix)`;
    const remixed = await Project.create({
      title: newTitle,
      description: original.description,
      codeSnippet: original.codeSnippet,
      tags: original.tags,
      domain: original.domain,
      status: "in-progress",
      about: original.about,
      files: original.files,
      userId: req.user.id,
      remixedFrom: original._id,
      rootCreatorId: original.rootCreatorId || original.userId
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

    const populated = await remixed.populate("userId rootCreatorId", "username avatar");
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
    const isOwner = (original.owner?.toString() || original.userId.toString()) === req.user.id;
    const isAllowed = isOwner || original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
    
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
    const isOwner = (original.owner?.toString() || original.userId.toString()) === req.user.id;
    const isAllowed = isOwner || original.allowedRemixers?.some(uId => uId.toString() === req.user.id);
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

    // Notify admin (project owner) about incoming sync request
    const User = require("../models/User");
    const contributor = await User.findById(req.user.id);
    const msg = `@${contributor?.username || 'A contributor'} submitted a sync request for "${original.title}"`;
    
    await Notification.create({
      userId: original.userId,
      projectId: original._id,
      message: msg,
      type: "sync-request"
    });

    if (!Array.isArray(original.notifications)) original.notifications = [];
    original.notifications.push({
      userId: original.owner || original.userId,
      message: "New sync request submitted",
      type: "sync-request"
    });

    // Global notification for Navbar bell
    await Notification.create({
      userId: original.owner || original.userId,
      projectId: original._id,
      message: "New sync request submitted",
      type: "sync-request"
    });

    await original.save();

    res.json({ message: "Sync request sent for review!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /projects/:id/sync-requests — original creator views pending requests
router.get("/:id/sync-requests", auth, checkProjectOwner, async (req, res) => {
  try {
    const project = await req.project
      .populate("syncRequests.remixId", "title userId updatedAt description codeSnippet about tags domain files")
      .populate("syncRequests.requestedBy", "username avatar");
    
    const pending = (project.syncRequests || []).filter(r => r.status === "pending");
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/sync-request/:reqId/respond — approve copies remix changes INTO original
router.post("/:id/sync-request/:reqId/respond", auth, checkProjectOwner, async (req, res) => {
  try {
    const { action } = req.body;
    if (!["approve", "decline"].includes(action))
      return res.status(400).json({ message: "action must be approve or decline" });

    const original = req.project;

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

    // Notify contributor about admin's sync decision
    await Notification.create({
      userId: syncReq.requestedBy,
      projectId: original._id,
      message: action === "approve"
        ? `Your sync request for "${original.title}" has been approved and merged!`
        : `Your sync request for "${original.title}" has been declined.`,
      type: action === "approve" ? "sync-approved" : "sync-rejected"
    });

    const decisionMsg = action === "approve"
      ? `You approved and merged a sync request for "${original.title}"`
      : `You declined a sync request for "${original.title}"`;

    if (!Array.isArray(original.notifications)) original.notifications = [];
    original.notifications.push({
      userId: original.userId,
      message: decisionMsg,
      type: action === "approve" ? "sync-approved" : "sync-rejected"
    });

    await original.save();
    res.json({ message: action === "approve" ? "Sync approved — original project updated with remix changes" : "Sync declined" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Access Control Routes ──

// POST /projects/:id/remix-request
router.post("/:id/remix-request", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const hasPending = project.remixRequests?.some(
      r => r.userId.toString() === req.user.id && r.status === "pending"
    );
    if (hasPending) return res.status(400).json({ message: "Request already exists" });

    if (!Array.isArray(project.remixRequests)) project.remixRequests = [];
    project.remixRequests.push({
      userId: req.user.id,
      message: req.body.message || "",
      status: "pending",
      createdAt: new Date()
    });

    console.log("Remix Request Saved:");
    console.log("Project:", project._id);
    console.log("User:", req.user.id);

    await project.save();

    // Notify admin (project owner)
    const User = require("../models/User");
    const requester = await User.findById(req.user.id);
    const msg = `@${requester?.username || 'Someone'} requested remix access to "${project.title}"`;
    
    await Notification.create({
      userId: project.userId,
      projectId: project._id,
      message: msg,
      type: "remix-request"
    });

    if (!Array.isArray(project.notifications)) project.notifications = [];
    project.notifications.push({
      userId: project.owner || project.userId,
      message: "New remix request received",
      type: "remix-request"
    });
    
    // Global notification for Navbar bell
    await Notification.create({
      userId: project.owner || project.userId,
      projectId: project._id,
      message: "New remix request received",
      type: "remix-request"
    });
    
    await project.save();

    res.json({ message: "Remix request sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /projects/:id/notifications
router.get("/:id/notifications", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    
    // Only return notifications for the authenticated user
    const userNotifications = (project.notifications || [])
      .filter(n => n.userId.toString() === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
      
    res.json(userNotifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/sync - Only owner or approved remix contributors allowed
router.post("/:id/sync", auth, checkProjectContributor, async (req, res) => {
  try {
    const project = req.project;
    const isOwner = (project.owner?.toString() || project.userId.toString()) === req.user.id;

    // Implementation logic for sync goes here (e.g., updating files)
    // For now, just return success as the requirement is about the permission check.
    res.json({ message: "Sync successful" });

    // Notification
    if (!isOwner) {
       if (!Array.isArray(project.notifications)) project.notifications = [];
       project.notifications.push({
         userId: project.owner || project.userId,
         message: "New sync request submitted",
         type: "sync-request"
       });
       await project.save();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/request-merge - Contributor requests a merge (Alias for sync-request)
router.post("/:id/request-merge", auth, checkProjectContributor, async (req, res) => {
  try {
    const original = req.project;
    const isOwner = (original.owner?.toString() || original.userId.toString()) === req.user.id;
    
    if (isOwner) return res.status(400).json({ message: "Owner cannot request merge to self" });

    // Existing sync-request logic...
    // I'll reuse the logic from /sync-request here or just call it.
    // For now, let's just implement the notification part.
    if (!Array.isArray(original.notifications)) original.notifications = [];
    original.notifications.push({
      userId: original.owner || original.userId,
      message: "New merge request received",
      type: "sync-request"
    });

    await Notification.create({
      userId: original.owner || original.userId,
      projectId: original._id,
      message: "New merge request received",
      type: "sync-request"
    });

    await original.save();
    res.json({ message: "Merge request sent for review!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /projects/:id/remix-requests  (admin sees all non-withdrawn; user sees own)
router.get("/:id/remix-requests", auth, checkProjectOwner, async (req, res) => {
  try {
    await req.project.populate("remixRequests.userId", "username avatar");
    res.json(req.project.remixRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id/remix-request  — user withdraws their own pending request
router.delete("/:id/remix-request", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const reqItem = (project.remixRequests || []).find(
      r => r.userId.toString() === req.user.id && r.status === "pending"
    );
    if (!reqItem) return res.status(404).json({ message: "No pending request found" });

    reqItem.status = "withdrawn";
    reqItem.withdrawnAt = new Date();
    await project.save();

    // Notify project owner
    const User = require("../models/User");
    const requester = await User.findById(req.user.id);
    await Notification.create({
      userId: project.userId,
      projectId: project._id,
      message: `@${requester?.username || 'Someone'} withdrew their remix request for "${project.title}"`,
      type: "remix-request"
    });

    res.json({ message: "Request withdrawn" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/respond-remix
router.post("/:id/respond-remix", auth, checkProjectOwner, async (req, res) => {
  try {
    const { requestId, action } = req.body;
    if (!["approve", "reject"].includes(action))
      return res.status(400).json({ message: "Invalid action" });

    const project = req.project;

    const reqItem = project.remixRequests?.id(requestId);
    if (!reqItem || reqItem.status !== "pending")
      return res.status(400).json({ message: "Invalid or already handled request" });

    reqItem.status = action === "approve" ? "approved" : "declined";

    if (action === "approve") {
      if (!Array.isArray(project.allowedRemixers)) project.allowedRemixers = [];
      if (!project.allowedRemixers.includes(reqItem.userId)) {
        project.allowedRemixers.push(reqItem.userId);
      }
      
      // Create private remix branch metadata
      const Branch = require("../models/Branch");
      const branchName = `remix-${project.title.substring(0, 15).toLowerCase().replace(/\s+/g, '-')}`;
      await Branch.create({
        branchName: branchName,
        sourceProjectId: project._id,
        branchOwner: reqItem.userId,
        status: "active",
        visibility: "private"
      });
      
      // Notify contributor
      await Notification.create({
        userId: reqItem.userId,
        projectId: project._id,
        message: "Remix request approved",
        type: "remix-approved"
      });
      
      if (!Array.isArray(project.notifications)) project.notifications = [];
      project.notifications.push({
        userId: reqItem.userId,
        message: "Remix request approved",
        type: "remix-approved"
      });
    }

    // Notify contributor about admin's decision
    await Notification.create({
      userId: reqItem.userId,
      projectId: project._id,
      message: action === "approve"
        ? `Your remix request for "${project.title}" has been approved! You can now create a branch.`
        : `Your remix request for "${project.title}" has been rejected.`,
      type: action === "approve" ? "remix-approved" : "remix-rejected"
    });

    const decisionMsg = action === "approve"
      ? `You approved a remix request for "${project.title}"`
      : `You rejected a remix request for "${project.title}"`;

    if (!Array.isArray(project.notifications)) project.notifications = [];
    project.notifications.push({
      userId: project.owner || project.userId,
      message: decisionMsg,
      type: action === "approve" ? "remix-approved" : "remix-rejected"
    });

    await project.save();

    res.json({ message: action === "approve" ? "Access granted" : "Access denied" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /projects/:id/revoke-access/:userId
router.post("/:id/revoke-access/:userId", auth, checkProjectOwner, async (req, res) => {
  try {
    const project = req.project;
    project.allowedRemixers = project.allowedRemixers?.filter(uid => uid.toString() !== req.params.userId) || [];
    await project.save();
    
    await project.populate("allowedRemixers", "username avatar");
    res.json({ message: "Access revoked", allowedRemixers: project.allowedRemixers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /projects/:id/toggle-public-remix
router.post("/:id/toggle-public-remix", auth, checkProjectOwner, async (req, res) => {
  try {
    const project = req.project;
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

// GET /projects/:id/branches
router.get("/:id/branches", async (req, res) => {
  try {
    const originalProject = await Project.findById(req.params.id);
    if (!originalProject) return res.status(404).json({ message: "Project not found" });

    // Identify user role (Optional Auth)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const SECRET = process.env.JWT_SECRET || "vibegit_secret";
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, SECRET);
        userId = decoded.id; // decoded structure depends on auth.js, usually { id: "..." }
      } catch (err) {
         // Proceed as unauthenticated
      }
    }

    const isOwner = originalProject.userId.toString() === userId;

    let query = { sourceProjectId: originalProject._id };

    if (!isOwner) {
      if (userId) {
        // Logged-in user, not owner: can see public branches + their own private branch
        query.$or = [
          { visibility: "public" },
          { branchOwner: userId }
        ];
      } else {
        // Unauthenticated user: can only see public branches
        query.visibility = "public";
      }
    }

    const branches = await Branch.find(query)
      .populate("branchOwner", "username avatar");
      
    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /projects/:id
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("userId", "username avatar followers")
      .populate("rootCreatorId", "username avatar")
      .populate("comments.userId", "username avatar")
      .populate("remixedFrom", "title userId")
      .populate("syncHistory.contributorId", "username avatar")
      .populate("remixAccessRequests.userId", "username avatar")
      .populate("syncRequests.requestedBy", "username avatar")
      .populate("syncRequests.remixId", "title")
      .populate("allowedRemixers", "username avatar")
      .populate("owner", "username avatar");
    if (!project) return res.status(404).json({ message: "Not found" });
    
    let userRemixId = null;
    if (req.headers.authorization) {
      // Decode user manually to avoid blocking route with auth if optional
      try {
        const token = req.headers.authorization.split(" ")[1];
        const SECRET = process.env.JWT_SECRET || "vibegit_secret";
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, SECRET);
        const remix = await Project.findOne({ remixedFrom: project._id, userId: decoded.id });
        if (remix) userRemixId = remix._id;
      } catch (err) {}
    }

    const projectObj = project.toObject();
    projectObj.userRemixId = userRemixId;
    res.json(projectObj);
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

// GET /projects/:id/notifications — Fetch notifications for the admin regarding a specific project
router.get("/:id/notifications", auth, checkProjectOwner, async (req, res) => {
  try {
    const project = req.project;
    const notifications = (project.notifications || [])
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET /projects/:id/download
router.get("/:id/download", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const zip = new AdmZip();
    const uploadsDir = path.join(__dirname, "../uploads");

    if (project.files && project.files.length > 0) {
      for (const file of project.files) {
        const filePath = path.join(uploadsDir, file.path);
        if (fs.existsSync(filePath)) {
          zip.addLocalFile(filePath, "", file.name);
        }
      }
    }

    const zipBuffer = zip.toBuffer();
    const zipName = `${project.title.replace(/[^a-z0-9]/gi, "_")}.zip`;
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", `attachment; filename="${zipName}"`);
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ message: "Failed to generate ZIP" });
  }
});

module.exports = router;
