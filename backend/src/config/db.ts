import mongoose from "mongoose";
import config from "./env";

const connectDB = async () => {
  try {
    console.log("🔄 Trying SRV...");
    await mongoose.connect(config.mongoUri!);
    console.log("✅ Connected SRV");
  } catch (err) {
    console.log("⚠️ SRV failed:", err);

    if (!config.mongoUri) {
      console.error("❌ No fallback URI");
      process.exit(1);
    }

    try {
      console.log("🔄 Trying fallback...");
      await mongoose.connect(config.mongoUri);
      console.log("✅ Connected fallback");
    } catch (err2) {
      console.error("❌ Fallback also failed:", err2);
      process.exit(1);
    }
  }
};

export default connectDB;
