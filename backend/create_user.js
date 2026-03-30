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

  const username = "admin_tester";
  const email = "admin@test.com";
  const password = "password123";

  // Delete existing if any
  await User.deleteOne({ username });
  await User.deleteOne({ email });

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hashedPassword });

  console.log(`User created. Username: ${username}, Password: ${password}`);
  await mongoose.disconnect();
}

run().catch(console.error);
