export function storageProviderId(): string {
  return process.env.STORAGE_PROVIDER ?? "fake";
}

export function recordingLocation(callPublicId: string, carrierUrl?: string): string {
  if (carrierUrl) return carrierUrl;
  const provider = storageProviderId();
  if (provider === "s3") {
    const bucket = process.env.S3_BUCKET ?? "zcg-recordings";
    return `s3://${bucket}/recordings/${callPublicId}.wav`;
  }
  return `s3://fake/recordings/${callPublicId}.wav`;
}
