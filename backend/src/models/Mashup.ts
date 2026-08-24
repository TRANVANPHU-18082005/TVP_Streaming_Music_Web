import mongoose, { Schema, Document } from "mongoose";
import { generateUniqueSlug } from "../utils/slug";

export interface IMashupShort {
  short: mongoose.Types.ObjectId;
  order: number;
  transitionType: 'crossfade' | 'cut' | 'beatmatch';
  transitionDuration: number;
}

export interface IMashup extends Document {
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  
  createdBy?: mongoose.Types.ObjectId;
  creationType: 'auto' | 'manual' | 'ai';
  
  shorts: IMashupShort[];
  
  compatibilityScore: number;
  avgTempo: number;
  avgEnergy: number;
  dominantMoods: string[];
  dominantGenres: mongoose.Types.ObjectId[];
  keySignature?: string;
  totalDuration: number;
  
  energyCurve: 'build-up' | 'chill' | 'peak' | 'wave' | 'custom';
  
  playCount: number;
  likeCount: number;
  shareCount: number;
  
  isPublished: boolean;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  
  mashupAudioUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const MashupShortSchema = new Schema<IMashupShort>({
  short: { type: Schema.Types.ObjectId, ref: 'TrackShort', required: true },
  order: { type: Number, required: true },
  transitionType: { type: String, enum: ['crossfade', 'cut', 'beatmatch'], default: 'crossfade' },
  transitionDuration: { type: Number, default: 2000 }
}, { _id: false });

const MashupSchema = new Schema<IMashup>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, required: true, trim: true },
    description: { type: String, maxlength: 2000 },
    coverImage: { type: String, default: "" },
    
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    creationType: { type: String, enum: ['auto', 'manual', 'ai'], default: 'manual' },
    
    shorts: [MashupShortSchema],
    
    compatibilityScore: { type: Number, default: 0, min: 0, max: 100 },
    avgTempo: { type: Number, default: 0 },
    avgEnergy: { type: Number, default: 0, min: 0, max: 1 },
    dominantMoods: [{ type: String, lowercase: true, trim: true }],
    dominantGenres: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
    keySignature: { type: String, trim: true },
    totalDuration: { type: Number, default: 0 },
    
    energyCurve: { type: String, enum: ['build-up', 'chill', 'peak', 'wave', 'custom'], default: 'custom' },
    
    playCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    
    isPublished: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'generating', 'ready', 'failed'], default: 'draft' },
    
    mashupAudioUrl: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug
MashupSchema.pre("save", async function () {
  const mashup = this as any;
  if (mashup.isModified("title") && !mashup.slug) {
    const MashupModel = mashup.constructor as mongoose.Model<IMashup>;
    mashup.slug = await generateUniqueSlug(
      MashupModel,
      mashup.title,
      mashup.isNew ? undefined : mashup._id
    );
  }
});

// Indexes
MashupSchema.index({ isPublished: 1, status: 1, createdAt: -1 });
MashupSchema.index({ createdBy: 1, createdAt: -1 });
MashupSchema.index({ title: 'text', description: 'text', dominantMoods: 'text' });

const Mashup = mongoose.model<IMashup>("Mashup", MashupSchema);
export default Mashup;
