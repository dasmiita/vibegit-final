const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema({
  branchName: { type: String, required: true },
  sourceProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  remixProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  branchOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  visibility: { type: String, enum: ["public", "private"], default: "private" },
  status: { type: String, enum: ["active", "merged", "rejected"], default: "active" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Branch", branchSchema);
