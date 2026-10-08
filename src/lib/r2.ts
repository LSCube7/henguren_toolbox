import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type HeadObjectCommandOutput } from "@aws-sdk/client-s3";

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
  return (await readVersionedJsonFromR2<T>(key)).value;
}

export async function readVersionedJsonFromR2<T>(key: string): Promise<{ value: T | null; etag: string | null }> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await response.Body?.transformToString();
    if (!body || !response.ETag) throw new Error("R2_INVALID_OBJECT");
    return { value: JSON.parse(body) as T, etag: response.ETag };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return { value: null, etag: null };
    throw error;
  }
}

type HeadObjectSender = (command: HeadObjectCommand) => Promise<Pick<HeadObjectCommandOutput, "ETag">>;

export async function readHeadObjectVersion(send: HeadObjectSender, bucketName: string, key: string): Promise<string | null> {
  try {
    const response = await send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    if (!response.ETag) throw new Error("R2_INVALID_OBJECT");
    return response.ETag;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const statusCode = error && typeof error === "object"
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
    if (name === "NoSuchKey" || name === "NotFound" || statusCode === 404) return null;
    throw error;
  }
}

export async function headObjectVersionFromR2(key: string): Promise<string | null> {
  const client = getR2Client();
  return readHeadObjectVersion((command) => client.send(command), bucket!, key);
}

export async function writeJsonToR2(key: string, value: unknown, expectedVersion?: string | null) {
  const response = await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json; charset=utf-8",
      ...(expectedVersion === undefined ? {} : expectedVersion === null ? { IfNoneMatch: "*" } : { IfMatch: expectedVersion })
    })
  );
  return response.ETag ?? null;
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
