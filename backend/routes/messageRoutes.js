const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const auth = require("../middleware/auth");

// GET /messages/unread/count
router.get("/unread/count", auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user.id,
      read: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /messages/conversations - Get a list of users the current user has chatted with
router.get("/conversations", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all messages where user is sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    }).sort({ createdAt: -1 });

    const partnerArray = [];
    const seen = new Set();

    for (let msg of messages) {
      const partnerId = msg.senderId.toString() === userId ? msg.receiverId.toString() : msg.senderId.toString();
      if (!seen.has(partnerId)) {
        seen.add(partnerId);
        partnerArray.push(partnerId);
      }
    }

    // Populate user details for each partner
    const partners = await User.find({ _id: { $in: partnerArray } }).select("username avatar");
    
    res.json(partners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /messages/:userId - Get chat history with a specific user
router.get("/:userId", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId }
      ]
    }).sort({ createdAt: 1 });

    // Mark unread as read
    await Message.updateMany(
      { senderId: partnerId, receiverId: userId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /messages/:userId - Send a message to a specific user
router.post("/:userId", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Empty message" });

    const message = await Message.create({
      senderId: req.user.id,
      receiverId: req.params.userId,
      text: text.trim()
    });

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
