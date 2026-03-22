/** Stop all tracks on a MediaStream (e.g. when closing the camera UI). */
export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Opens the device camera for live preview. Requires a secure context (HTTPS or localhost).
 * On desktop/laptop Chrome, this uses the default webcam — `facingMode` is a hint only.
 */
export async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser or context.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
}

export async function captureFrameFile(
  video: HTMLVideoElement,
  filename = "nutrilog-camera.jpg",
): Promise<File> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) {
    throw new Error("Camera preview is not ready yet. Try again in a moment.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not capture frame.");
  }
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  if (!blob) {
    throw new Error("Could not create image file.");
  }
  return new File([blob], filename, { type: "image/jpeg" });
}
