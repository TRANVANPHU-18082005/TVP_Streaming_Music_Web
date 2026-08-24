import mongoose from "mongoose";
import Mashup, { IMashup, IMashupShort } from "../models/Mashup";
import TrackShort from "../models/TrackShort";
import Track from "../models/Track";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { addProcessMashupJob } from "../queue/mashup.queue";

interface CompatibilityResult {
  score: number;
  tempoScore: number;
  keyScore: number;
  energyScore: number;
  moodScore: number;
  genreScore: number;
  details: any;
}

class MashupService {
  // === COMPATIBILITY ALGORITHM ===
  
  /**
   * Tính toán độ tương thích giữa 2 đoạn short liền kề
   */
  private calculatePairCompatibility(track1: any, track2: any): CompatibilityResult {
    const meta1 = track1.aiMetadata || {};
    const meta2 = track2.aiMetadata || {};

    let tempoScore = 0;
    let keyScore = 0;
    let energyScore = 0;
    let moodScore = 0;
    let genreScore = 0;

    // 1. Tempo (30%): Khuyến khích BPM gần nhau hoặc gấp đôi/chia đôi
    if (meta1.tempo && meta2.tempo) {
      const t1 = meta1.tempo;
      const t2 = meta2.tempo;
      const ratio = Math.max(t1, t2) / Math.min(t1, t2);
      
      if (Math.abs(t1 - t2) <= 15) { // Gần giống nhau
        tempoScore = 1 - (Math.abs(t1 - t2) / 15);
      } else if (Math.abs(ratio - 2) < 0.1) { // Gấp đôi (double time/half time)
        tempoScore = 0.8;
      } else {
        tempoScore = 0.1;
      }
    } else {
      tempoScore = 0.5; // Neutral nếu thiếu data
    }

    // 2. Key (25%): (Giả lập Camelot wheel đơn giản - nếu giống hệt thì max)
    if (meta1.musicalKey && meta2.musicalKey) {
      if (meta1.musicalKey === meta2.musicalKey) keyScore = 1.0;
      // TODO: Thêm logic Camelot wheel thật (cần map string sang camelot number)
      else keyScore = 0.4; // Tạm thời
    } else {
      keyScore = 0.5;
    }

    // 3. Energy (20%): Transition không được giật cục
    if (meta1.energy !== undefined && meta2.energy !== undefined) {
      const diff = Math.abs(meta1.energy - meta2.energy);
      if (diff <= 0.2) energyScore = 1.0;
      else if (diff <= 0.4) energyScore = 0.7;
      else if (diff <= 0.6) energyScore = 0.4;
      else energyScore = 0.1;
    } else {
      energyScore = 0.5;
    }

    // 4. Mood (15%): Jaccard index
    const moods1 = meta1.moods || [];
    const moods2 = meta2.moods || [];
    if (moods1.length > 0 && moods2.length > 0) {
      const intersection = moods1.filter((m: string) => moods2.includes(m));
      const union = new Set([...moods1, ...moods2]);
      moodScore = intersection.length / union.size;
    } else {
      moodScore = 0.5;
    }

    // 5. Genre (10%): Jaccard index
    const genres1 = (track1.genres || []).map((g: any) => g.toString());
    const genres2 = (track2.genres || []).map((g: any) => g.toString());
    if (genres1.length > 0 && genres2.length > 0) {
      const intersection = genres1.filter((g: string) => genres2.includes(g));
      const union = new Set([...genres1, ...genres2]);
      genreScore = intersection.length / union.size;
    } else {
      genreScore = 0.5;
    }

    // Tổng điểm
    const totalScore = (tempoScore * 30) + (keyScore * 25) + (energyScore * 20) + (moodScore * 15) + (genreScore * 10);

    return {
      score: Math.round(totalScore),
      tempoScore, keyScore, energyScore, moodScore, genreScore,
      details: { t1: meta1.tempo, t2: meta2.tempo }
    };
  }

  /**
   * Tính toán metadata tổng thể cho cả Mashup
   */
  public async calculateMashupMetadata(shortsData: any[]) {
    if (shortsData.length === 0) return null;

    let totalScore = 0;
    let totalTempo = 0;
    let totalEnergy = 0;
    let validTempo = 0;
    let validEnergy = 0;
    const moodCounts: Record<string, number> = {};
    const genreCounts: Record<string, number> = {};
    let totalDuration = 0;

    for (let i = 0; i < shortsData.length; i++) {
      const short = shortsData[i];
      const track = short.track;
      if (!track) continue;

      totalDuration += short.duration || 0;

      const meta = track.aiMetadata || {};
      if (meta.tempo) { totalTempo += meta.tempo; validTempo++; }
      if (meta.energy !== undefined) { totalEnergy += meta.energy; validEnergy++; }

      (meta.moods || []).forEach((m: string) => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
      (track.genres || []).forEach((g: any) => { 
        const gid = typeof g === 'object' ? g._id.toString() : g.toString();
        genreCounts[gid] = (genreCounts[gid] || 0) + 1; 
      });

      // Tính điểm compatibility với short liền sau
      if (i < shortsData.length - 1) {
        const nextTrack = shortsData[i+1].track;
        if (nextTrack) {
          const pairComp = this.calculatePairCompatibility(track, nextTrack);
          totalScore += pairComp.score;
        }
      }
    }

    const avgScore = shortsData.length > 1 ? Math.round(totalScore / (shortsData.length - 1)) : 100;
    const dominantMoods = Object.entries(moodCounts).sort((a,b) => b[1]-a[1]).slice(0, 3).map(e => e[0]);
    const dominantGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0, 2).map(e => new mongoose.Types.ObjectId(e[0]));

    return {
      compatibilityScore: avgScore,
      avgTempo: validTempo ? Math.round(totalTempo / validTempo) : 0,
      avgEnergy: validEnergy ? Number((totalEnergy / validEnergy).toFixed(2)) : 0,
      dominantMoods,
      dominantGenres,
      totalDuration,
      // Đơn giản hóa energy curve
      energyCurve: 'custom' as const
    };
  }

  // === CRUD OPERATIONS ===

  async createMashup(userId: string | undefined, data: Partial<IMashup>): Promise<IMashup> {
    // 1. Lấy thông tin các shorts
    if (!data.shorts || data.shorts.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Mashup must contain at least one short");
    }

    const shortIds = data.shorts.map(s => s.short);
    const populatedShorts = await TrackShort.find({ _id: { $in: shortIds } }).populate('track').lean();

    // Sắp xếp lại theo order
    const sortedShortsData = data.shorts.map(s => {
      const found = populatedShorts.find(ps => ps._id.toString() === s.short.toString());
      return { ...s, track: found?.track, duration: found?.duration };
    });

    // 2. Tính toán metadata
    const metadata = await this.calculateMashupMetadata(sortedShortsData);

    const mashupData = {
      ...data,
      ...metadata,
      ...(userId ? { createdBy: userId } : {}),
      creationType: (userId ? 'manual' : 'auto') as 'manual' | 'auto',
      status: 'ready' as 'ready' // Tạm thời ready ngay cho client-side. Nếu Phase 2 thì 'generating'
    };

    const mashup = await Mashup.create(mashupData);
    
    // Đẩy vào queue xử lý FFmpeg (Phase 2)
    await addProcessMashupJob(mashup._id.toString());
    
    return mashup.populate([
      { path: 'createdBy', select: 'name avatar' },
      { path: 'shorts.short', populate: { path: 'track', populate: { path: 'artist' } } },
      { path: 'dominantGenres' }
    ]);
  }

  async getMashupById(id: string): Promise<IMashup> {
    const mashup = await Mashup.findById(id).populate([
      { path: 'createdBy', select: 'name avatar' },
      { path: 'shorts.short', populate: [{ path: 'track', populate: { path: 'artist' } }, { path: 'moodVideo' }] },
      { path: 'dominantGenres' }
    ]);
    if (!mashup) {
      throw new ApiError(httpStatus.NOT_FOUND, "Mashup not found");
    }
    return mashup;
  }

  async getFeed(
    limit: number = 10,
    cursor?: string,
  ): Promise<{ feed: IMashup[]; nextCursor: string | null }> {
    const query: any = { isPublished: true, status: 'ready' };

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const mashups = await Mashup.find(query)
      .sort({ compatibilityScore: -1, _id: -1 })
      .limit(Number(limit))
      .populate([
        { path: 'createdBy', select: 'name avatar' },
        { path: 'shorts.short', populate: [{ path: 'track', populate: { path: 'artist', select: 'name slug' } }, { path: 'moodVideo', select: 'videoUrl thumbnailUrl' }] },
      ])
      .lean();

    const nextCursor = mashups.length === Number(limit)
      ? String(mashups[mashups.length - 1]._id)
      : null;

    return { feed: mashups as unknown as IMashup[], nextCursor };
  }


  async suggestNextShorts(currentShortIds: string[]): Promise<any[]> {
    if (currentShortIds.length === 0) return [];
    
    const lastShortId = currentShortIds[currentShortIds.length - 1];
    const lastShort = await TrackShort.findById(lastShortId).populate('track').lean();
    if (!lastShort || !lastShort.track) return [];

    const meta = (lastShort.track as any).aiMetadata;
    if (!meta) return [];

    const candidates = await TrackShort.find({ _id: { $nin: currentShortIds }, isPublished: true })
      .populate('track')
      .limit(50)
      .lean();

    const scoredCandidates = candidates.map(candidate => {
      if (!candidate.track) return { ...candidate, compatibilityScore: 0 };
      const comp = this.calculatePairCompatibility(lastShort.track, candidate.track);
      return { ...candidate, compatibilityScore: comp.score };
    });

    scoredCandidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    return scoredCandidates.slice(0, 10);
  }

  async getMyMashups(userId: string, filters: any = {}): Promise<{ data: IMashup[]; total: number }> {
    const { page = 1, limit = 20, status } = filters;
    const query: any = { createdBy: userId };
    if (status) query.status = status;
    if (filters.isPublished !== undefined) query.isPublished = filters.isPublished;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      Mashup.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate([
          { path: 'shorts.short', populate: { path: 'track', select: 'title coverImage artist', populate: { path: 'artist', select: 'name' } } },
        ])
        .lean(),
      Mashup.countDocuments(query),
    ]);
    return { data: data as unknown as IMashup[], total };
  }

  async updateMashup(id: string, userId: string, data: Partial<IMashup>): Promise<IMashup> {
    const mashup = await Mashup.findOne({ _id: id, createdBy: userId });
    if (!mashup) throw new ApiError(httpStatus.NOT_FOUND, 'Mashup not found or no permission');

    // If shorts changed, recalculate metadata
    if (data.shorts && data.shorts.length > 0) {
      const shortIds = data.shorts.map(s => s.short);
      const populated = await TrackShort.find({ _id: { $in: shortIds } }).populate('track').lean();
      const sorted = data.shorts.map(s => {
        const found = populated.find(p => p._id.toString() === s.short.toString());
        return { ...s, track: found?.track, duration: (found as any)?.duration };
      });
      const metadata = await this.calculateMashupMetadata(sorted);
      Object.assign(data, metadata);
    }

    // Auto cover from first track
    if (!data.coverImage && data.shorts && data.shorts.length > 0) {
      const firstShortId = data.shorts[0].short;
      const firstShort = await TrackShort.findById(firstShortId).populate({ path: 'track', select: 'coverImage' }).lean();
      data.coverImage = (firstShort?.track as any)?.coverImage || '';
    }

    Object.assign(mashup, data);
    return mashup.save();
  }

  async deleteMashup(id: string, userId: string): Promise<void> {
    const result = await Mashup.findOneAndDelete({ _id: id, createdBy: userId });
    if (!result) throw new ApiError(httpStatus.NOT_FOUND, 'Mashup not found or no permission');
  }

  async toggleLike(id: string): Promise<{ likeCount: number }> {
    const mashup = await Mashup.findByIdAndUpdate(id, { $inc: { likeCount: 1 } }, { new: true });
    if (!mashup) throw new ApiError(httpStatus.NOT_FOUND, 'Mashup not found');
    return { likeCount: mashup.likeCount };
  }

  async recordShare(id: string): Promise<void> {
    await Mashup.findByIdAndUpdate(id, { $inc: { shareCount: 1 } });
  }

  async togglePublish(id: string, userId: string, isPublished: boolean): Promise<IMashup> {
    const mashup = await Mashup.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { isPublished },
      { new: true }
    );
    if (!mashup) throw new ApiError(httpStatus.NOT_FOUND, 'Mashup not found or no permission');
    return mashup;
  }
}

export default new MashupService();
