import { JobsOptions } from "bullmq";

export interface ProcessMashupJobData {
  mashupId: string;
}

/**
 * Server-side mashup audio stitching is not running.
 * The placeholder worker is intentionally not started, so this refuses
 * to enqueue `mashup-processing` jobs that nothing would consume.
 */
export async function addProcessMashupJob(
  mashupId: string,
  _opts: JobsOptions = {},
): Promise<void> {
  console.error(
    `[Queue] Refusing mashup-processing job for ${mashupId}: worker is not running`,
  );
  throw new Error(
    "Mashup processing worker is not running; refusing to enqueue",
  );
}
