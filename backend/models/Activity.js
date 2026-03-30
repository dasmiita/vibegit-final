const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      { type: String, enum: ["created", "liked", "remixed", "followed", "commented", "sync_requested", "sync_approved", "remix_requested"], required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
  targetId:  { type: mongoose.Schema.Types.ObjectId, default: null }, // user or project being acted on
  meta:      { type: String, default: "" }, // e.g. original project title for remix
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Activity", activitySchema);
