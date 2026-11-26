import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import { uploadJson, listKeys, getDownloadUrl } from "./solution.mjs";

// --- Test uploadJson: verify it sends a PutObjectCommand with correct params ---
let putCall;
const fakeS3Upload = {
  send: async (command) => {
    putCall = command;
    return {};
  },
};
await uploadJson(fakeS3Upload, "my-bucket", "path/to/data.json", { hello: "world" });
assert.equal(putCall.constructor.name, "PutObjectCommand");
assert.equal(putCall.input.Bucket, "my-bucket");
assert.equal(putCall.input.Key, "path/to/data.json");
assert.equal(putCall.input.ContentType, "application/json");
assert.equal(putCall.input.Body, JSON.stringify({ hello: "world" }));
console.log("uploadJson: OK");

// --- Test listKeys: verify pagination is handled and all keys are returned ---
let callCount = 0;
const fakeS3List = {
  send: async (command) => {
    assert.equal(command.constructor.name, "ListObjectsV2Command");
    assert.equal(command.input.Bucket, "my-bucket");
    assert.equal(command.input.Prefix, "logs/");
    callCount++;
    if (callCount === 1) {
      assert.equal(command.input.ContinuationToken, undefined);
      return {
        Contents: [{ Key: "logs/a.txt" }, { Key: "logs/b.txt" }],
        IsTruncated: true,
        NextContinuationToken: "token-2",
      };
    } else if (callCount === 2) {
      assert.equal(command.input.ContinuationToken, "token-2");
      return {
        Contents: [{ Key: "logs/c.txt" }],
        IsTruncated: false,
      };
    }
    throw new Error("called too many times");
  },
};
const keys = await listKeys(fakeS3List, "my-bucket", "logs/");
assert.deepEqual(keys, ["logs/a.txt", "logs/b.txt", "logs/c.txt"]);
assert.equal(callCount, 2);
console.log("listKeys (pagination): OK");

// --- Test listKeys: empty result ---
const fakeS3Empty = {
  send: async () => ({ Contents: [], IsTruncated: false }),
};
const emptyKeys = await listKeys(fakeS3Empty, "my-bucket", "nothing/");
assert.deepEqual(emptyKeys, []);
console.log("listKeys (empty): OK");

// --- Test getDownloadUrl: real S3Client (dummy creds), no network call, just local signing ---
const realClient = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: "AKIAFAKEFAKEFAKEFAKE", secretAccessKey: "fakefakefakefakefakefakefakefakefakefake" },
});
const url = await getDownloadUrl(realClient, "my-bucket", "path/to/data.json");
assert.match(url, /^https:\/\/my-bucket\.s3\.us-east-1\.amazonaws\.com\/path\/to\/data\.json\?/);
assert.match(url, /X-Amz-Expires=900/);
assert.match(url, /X-Amz-Signature=/);
console.log("getDownloadUrl: OK, url =", url);

console.log("\nAll smoke tests passed.");
