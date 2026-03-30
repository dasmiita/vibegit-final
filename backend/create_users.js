const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI = "mongodb+srv://dasmiita:innu2013@vibegit.ksnhxcx.mongodb.net/vibegit";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const users = [
    { username: "admin_tester", email: "admin@test.com", password: "password123" },
    { username: "tester_two", email: "tester2@test.com", password: "password123" }
  ];

  for (const u of users) {
    await User.deleteOne({ username: u.username });
    await User.deleteOne({ email: u.email });
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await User.create({ username: u.username, email: u.email, password: hashedPassword });
    console.log(`User created: ${u.username}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
