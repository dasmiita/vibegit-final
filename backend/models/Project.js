const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:      { type: String, required: true },
  likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

const aboutSchema = new mongoose.Schema({
  features:    { type: String, default: "" },
  howItWorks:  { type: String, default: "" },
  futurePlans: { type: String, default: "" }
}, { _id: false });

// Each version is a snapshot of editable fields at the time of an edit
const versionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  title:         { type: String, required: true },
  description:   { type: String, required: true },
  codeSnippet:   { type: String, default: "" },
  about:         { type: aboutSchema, default: () => ({}) },
  status:        { type: String, default: "idea" },
  tags:          [{ type: String }],
  domain:        { type: String, default: "" },
  editedAt:      { type: Date, default: Date.now }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  // Latest version fields (always up to date)
  title:        { type: String, required: true },
  description:  { type: String, required: true },
  codeSnippet:  { type: String, default: "" },
  about:        { type: aboutSchema, default: () => ({}) },
  status:       { type: String, enum: ["completed", "in-progress", "idea"], default: "idea" },
  tags:         [{ type: String }],
  domain:       { type: String, default: "" },
  files:        [{ name: String, path: String, size: Number }],

  // Versioning
  versions:     [versionSchema],
  currentVersion: { type: Number, default: 1 },

  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  likes:        [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments:     [commentSchema],
  remixedFrom:  { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
  remixCount:   { type: Number, default: 0 },
  isPublicRemix: { type: Boolean, default: true }, // Whether anyone can remix or it requires approval
  allowedRemixers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  remixAccessRequests: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
  }],
  remixRequests: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
  }],
  syncRequests: [{
    remixId:       { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    requestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    summary:       { type: String, default: "" }, // Change summary/commit message
    status:        { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
    createdAt:     { type: Date, default: Date.now }
  }],
  syncHistory:  [{
    remixId:       { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    contributorId: { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    versionNumber: { type: Number },
    approvedAt:    { type: Date, default: Date.now }
  }],
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model("Project", projectSchema);
