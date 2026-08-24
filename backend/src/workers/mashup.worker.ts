import { Worker, Job } from "bullmq";
import { queueRedis } from "../config/redis";
import { ProcessMashupJobData } from "../queue/mashup.queue";
import Mashup from "../models/Mashup";
import TrackShort from "../models/TrackShort";
// NOTE: Phase 2 FFmpeg processing logic goes here.
// For now, this is a placeholder worker that simply marks it as 'ready'.

export const mashupWorker = new Worker<ProcessMashupJobData>(
  "mashup-processing",
  async (job: Job<ProcessMashupJobData>) => {
    const { mashupId } = job.data;
    console.log(`[Worker] Bắt đầu xử lý mashup ${mashupId}...`);
    
    const mashup = await Mashup.findById(mashupId);
    if (!mashup) {
      throw new Error(`Mashup ${mashupId} not found`);
    }
    
    try {
      // TODO: Implementation of FFmpeg audio stitching:
      // 1. Download all shorts audio files.
      // 2. Cut them from startTime to endTime.
      // 3. Apply crossfade / transitions using ffmpeg complex filters.
      // 4. Upload the final file to B2 storage.
      // 5. Update mashup.mashupAudioUrl = new_url
      
      mashup.status = 'ready';
      await mashup.save();
      
      console.log(`[Worker] Mashup ${mashupId} xử lý xong.`);
    } catch (error) {
      console.error(`[Worker] Mashup ${mashupId} lỗi:`, error);
      mashup.status = 'failed';
      await mashup.save();
      throw error;
    }
  },
  {
    connection: queueRedis,
    concurrency: 2, 
  }
);

mashupWorker.on("completed", (job) => {
  console.log(`✅ [Worker] Job process mashup hoàn thành: ${job.id}`);
});

mashupWorker.on("failed", (job, err) => {
  console.error(`❌ [Worker] Job process mashup thất bại: ${job?.id} - Lỗi: ${err.message}`);
});
