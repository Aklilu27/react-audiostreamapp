"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const node_sdk_1 = require("@stream-io/node-sdk");
// Prefer environment variables for secrets. If not provided, fall back to the
// current hard-coded values so local development still works.
const apiKey = "rgsrdsbqkcm5";
const apiSecret = "dy5bgdpg2pvp6ay9c479duqpgpus7p6zhxrnzyu8hzq6kwng7jr7a2dt9cy4gy2q";
exports.Client = new node_sdk_1.StreamClient(apiKey, apiSecret);
//# sourceMappingURL=stream-client.js.map