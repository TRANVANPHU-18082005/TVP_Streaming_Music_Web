import mongoose from "mongoose";
import dotenv from "dotenv";
import Artist from "./models/Artist";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "");
    console.log("🔌 Connected to DB for Seeding...");

    // Kiểm tra xem có artist nào chưa
    const count = await Artist.countDocuments();
    if (count === 0) {
      const newArtist = await Artist.create({
        name: "Son Tung MTP",
        bio: "Famous Vietnamese Singer",
      });
      console.log(
        `✅ Created Artist: ${newArtist.name} - ID: ${newArtist._id}`,
      );
      console.log("⚠️ HÃY COPY ID Ở TRÊN ĐỂ DÙNG KHI TEST UPLOAD!");
    } else {
      console.log("Artist data already exists.");
      // In ra ID của artist đầu tiên để bạn copy
      const artist = await Artist.findOne();
      console.log(`ℹ️ Existing Artist ID: ${artist?._id}`);
    }

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();
