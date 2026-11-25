import { VideoPresets, type RoomOptions } from "livekit-client";

// Cameras and screens are sent sharp enough for the 720p stream: 720p camera
// at a high bitrate, screens at 1080p (text and the cropped pitch stay legible).
// Each sender also sends small copies (simulcast), so the director's monitors
// can take a light one (adaptiveStream) while the stream renderer, which
// doesn't adapt, always gets the best.
export function studioRoomOptions(adaptive: boolean): RoomOptions {
  return {
    adaptiveStream: adaptive,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    publishDefaults: {
      videoEncoding: { maxBitrate: 2_800_000, maxFramerate: 30 },
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 15 },
      degradationPreference: "maintain-resolution",
    },
  };
}

// One object for the whole page (the room is created once from it).
export const ADAPTIVE_ROOM = studioRoomOptions(true);
