import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.R2_BUCKET_NAME;

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export async function readJsonFromR2<T>(key: string): Promise<T | null> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await response.Body?.transformToString();
    return body ? (JSON.parse(body) as T) : null;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

export async function writeJsonToR2(key: string, value: unknown) {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json; charset=utf-8"
    })
  );
}

export function wrongBookKey(userId: string) {
  return `wrongbooks/${userId}/current.json`;
}

export function wrongBookBackupKey(userId: string, timestamp: string) {
  return `wrongbooks/${userId}/backups/${timestamp}.json`;
}

export function settingsKey(userId: string) {
  return `settings/${userId}/current.json`;
}
