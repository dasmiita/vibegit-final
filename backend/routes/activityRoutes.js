const express = require("express");
const router = express.Router();
const Activity = require("../models/Activity");
const User = require("../models/User");

// GET /activity — global feed (last 50)
router.get("/", async (req, res) => {
  try {
    const privateUsers = await User.find({ isPrivate: true }).select("_id");
    const privateIds = privateUsers.map(u => u._id.toString());

    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "username avatar")
      .populate("projectId", "title");

    const filtered = activities
      .filter(a => !privateIds.includes(a.userId?._id?.toString()))
      .slice(0, 50);

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /activity/user/:id — activity for a specific user
router.get("/user/:id", async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("userId", "username avatar")
      .populate("projectId", "title");
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
