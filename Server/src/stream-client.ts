import { StreamClient } from "@stream-io/node-sdk";


const apiKey = "rgsrdsbqkcm5";
const apiSecret = "dy5bgdpg2pvp6ay9c479duqpgpus7p6zhxrnzyu8hzq6kwng7jr7a2dt9cy4gy2q";


export const Client = new StreamClient(apiKey, apiSecret);