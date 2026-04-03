const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:      { type: String, required: true },
  likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

const contributorRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, default: "" },
  status: { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const ideaSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  description:  { type: String, required: true },
  techStack:    [{ type: String }],
  tags:         [{ type: String }],
  difficulty:   { type: String, enum: ["beginner", "intermediate", "advanced", "all"], default: "all" },
  visibility:   { type: String, enum: ["public", "private", "invite-only"], default: "public" },
  files:        [{ name: String, path: String, size: Number }],
  
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  followers:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments:     [commentSchema],
  
  contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  contributorRequests: [contributorRequestSchema],
  
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model("Idea", ideaSchema);
