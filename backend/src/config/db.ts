import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("🔄 Trying SRV...");
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("✅ Connected SRV");
  } catch (err) {
    console.log("⚠️ SRV failed:", err);

    if (!process.env.MONGO_URI) {
      console.error("❌ No fallback URI");
      process.exit(1);
    }

    try {
      console.log("🔄 Trying fallback...");
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ Connected fallback");
    } catch (err2) {
      console.error("❌ Fallback also failed:", err2);
      process.exit(1);
    }
  }
};

export default connectDB;
