import assert from "node:assert/strict";
import {
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { uploadJson, listKeys, getDownloadUrl } from "./solution.mjs";

// --- Mock S3 client ---
const mockS3 = {
  send: async (command) => {
    if (command instanceof PutObjectCommand) {
      assert.equal(command.input.Bucket, "my-bucket");
      assert.equal(command.input.Key, "data/file.json");
      assert.equal(command.input.ContentType, "application/json");
      assert.deepEqual(JSON.parse(command.input.Body), { hello: "world" });
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      assert.equal(command.input.Bucket, "my-bucket");
      assert.equal(command.input.Prefix, "data/");
      if (!command.input.ContinuationToken) {
        return {
          Contents: [{ Key: "data/a.json" }, { Key: "data/b.json" }],
          NextContinuationToken: "page2",
          IsTruncated: true,
        };
      } else {
        return { Contents: [{ Key: "data/c.json" }], IsTruncated: false };
      }
    }
    throw new Error("unexpected command: " + command.constructor.name);
  },
};

// Test uploadJson
await uploadJson(mockS3, "my-bucket", "data/file.json", { hello: "world" });
console.log("uploadJson OK");

// Test listKeys (pagination)
const keys = await listKeys(mockS3, "my-bucket", "data/");
assert.deepEqual(keys, ["data/a.json", "data/b.json", "data/c.json"]);
console.log("listKeys OK (paginated, got", keys.length, "keys)");

// Test getDownloadUrl - use a real S3Client (fake creds, no network call needed
// for signing) so the presigner logic runs end-to-end.
const realClient = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
});
const url = await getDownloadUrl(realClient, "my-bucket", "data/file.json");
assert.ok(url.startsWith("https://"));
assert.ok(url.includes("data/file.json") || url.includes("data%2Ffile.json"));
assert.ok(url.includes("X-Amz-Expires=900"));
console.log("getDownloadUrl OK:", url);

console.log("\nAll checks passed.");
