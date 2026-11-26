import { S3Client } from "@aws-sdk/client-s3";
import { uploadJson, listKeys, getDownloadUrl } from "./solution.mjs";

// --- Test 1: uploadJson sends correct PutObjectCommand ---
let putCall;
const fakeClient1 = {
  send: async (command) => {
    putCall = command;
    return { ETag: '"fake-etag"' };
  },
};
await uploadJson(fakeClient1, "my-bucket", "foo/bar.json", { hello: "world" });
console.assert(putCall.constructor.name === "PutObjectCommand", "uploadJson should send PutObjectCommand");
console.assert(putCall.input.Bucket === "my-bucket", "bucket mismatch");
console.assert(putCall.input.Key === "foo/bar.json", "key mismatch");
console.assert(putCall.input.ContentType === "application/json", "content type mismatch");
console.assert(putCall.input.Body === JSON.stringify({ hello: "world" }), "body mismatch");
console.log("uploadJson: OK ->", putCall.input);

// --- Test 2: listKeys paginates through ListObjectsV2Command results ---
let callCount = 0;
const fakeClient2 = {
  send: async (command) => {
    console.assert(command.constructor.name === "ListObjectsV2Command", "listKeys should send ListObjectsV2Command");
    console.assert(command.input.Bucket === "my-bucket", "bucket mismatch");
    console.assert(command.input.Prefix === "foo/", "prefix mismatch");
    callCount++;
    if (callCount === 1) {
      return {
        Contents: [{ Key: "foo/a.json" }, { Key: "foo/b.json" }],
        NextContinuationToken: "token-2",
      };
    }
    return {
      Contents: [{ Key: "foo/c.json" }],
      NextContinuationToken: undefined,
    };
  },
};
const keys = await listKeys(fakeClient2, "my-bucket", "foo/");
console.assert(callCount === 2, "listKeys should paginate across 2 calls, got " + callCount);
console.assert(JSON.stringify(keys) === JSON.stringify(["foo/a.json", "foo/b.json", "foo/c.json"]), "listKeys returned wrong keys: " + JSON.stringify(keys));
console.log("listKeys: OK ->", keys);

// --- Test 3: getDownloadUrl returns a presigned URL (no network call needed to sign) ---
const realClient = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: "AKIAFAKEFAKEFAKEFAKE", secretAccessKey: "fakefakefakefakefakefakefakefakefakefake" },
});
const url = await getDownloadUrl(realClient, "my-bucket", "foo/bar.json");
console.assert(typeof url === "string" && url.startsWith("https://my-bucket.s3.us-east-1.amazonaws.com/foo/bar.json"), "unexpected url shape: " + url);
console.assert(url.includes("X-Amz-Expires=900"), "expected 15 minute (900s) expiry, got: " + url);
console.assert(url.includes("X-Amz-Signature="), "expected a signature in the presigned url");
console.log("getDownloadUrl: OK ->", url);

console.log("\nAll tests passed.");
