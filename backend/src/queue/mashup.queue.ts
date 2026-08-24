import { Queue, JobsOptions } from "bullmq";
import { queueRedis } from "../config/redis";

export interface ProcessMashupJobData {
  mashupId: string;
}

export const mashupQueue = new Queue<ProcessMashupJobData>("mashup-processing", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 10, age: 3_600 },
    removeOnFail: { count: 20, age: 86_400 },
  },
});

export async function addProcessMashupJob(
  mashupId: string,
  opts: JobsOptions = {}
): Promise<void> {
  const jobId = opts.jobId ?? `mashup-${mashupId}-${Date.now()}`;
  await mashupQueue.add("process", { mashupId }, { ...opts, jobId });
  console.log(`📥 [Queue] Job process added for mashup ${mashupId}`);
}
