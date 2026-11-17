import { EventEmitter } from 'events';

class JobEventEmitter extends EventEmitter {}

export const jobEvents = new JobEventEmitter();
// Support up to 1000 concurrent listeners per node instance
jobEvents.setMaxListeners(1000);

/**
 * Broadcasts an updated public tracking payload to any active SSE subscribers for this job.
 */
export const broadcastJobUpdate = (jobId: string, payload: any) => {
  jobEvents.emit(`job:${jobId}`, payload);
};
