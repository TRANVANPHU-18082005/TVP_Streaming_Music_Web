import mongoose, { Schema, Document } from "mongoose";

export type ShortModerationStatus = "pending" | "approved" | "rejected";

export interface ITrackShort extends Document {
  track: mongoose.Types.ObjectId;
  moodVideo?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;

  startTime: number;
  endTime: number;
  duration: number;

  title?: string;
  caption?: string;

  suggestedByAi: boolean;
  aiConfidence?: number;

  isPublished: boolean;
  moderationStatus: ShortModerationStatus;
  rejectionReason?: string;
  priority: number;

  viewCount: number;
  likeCount: number;
  shareCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const TrackShortSchema = new Schema<ITrackShort>(
  {
    track: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    moodVideo: { type: Schema.Types.ObjectId, ref: "TrackMoodVideo" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    
    startTime: { type: Number, required: true, min: 0 },
    endTime: { type: Number, required: true, min: 0 },
    
    title: { type: String, trim: true },
    caption: { type: String, trim: true, maxlength: 500 },
    
    suggestedByAi: { type: Boolean, default: false },
    aiConfidence: { type: Number, min: 0, max: 1 },
    
    isPublished: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    priority: { type: Number, default: 0 },
    
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for duration
TrackShortSchema.virtual("duration").get(function () {
  return (this.endTime || 0) - (this.startTime || 0);
});

// Middleware for validation
TrackShortSchema.pre("validate", function () {
  if (this.startTime >= this.endTime) {
    this.invalidate("startTime", "startTime must be less than endTime");
  }
  const duration = this.endTime - this.startTime;
  if (duration < 10) {
    this.invalidate("endTime", "Short duration must be at least 10 seconds");
  }
  if (duration > 60) {
    this.invalidate("endTime", "Short duration must not exceed 60 seconds");
  }
});

// Indexes
TrackShortSchema.index({ isPublished: 1, moderationStatus: 1, priority: -1, createdAt: -1 });
TrackShortSchema.index({ track: 1 });
TrackShortSchema.index({ createdBy: 1, createdAt: -1 });

const TrackShort = mongoose.model<ITrackShort>("TrackShort", TrackShortSchema);
export default TrackShort;
