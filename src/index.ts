import { jsonrpcSource, grpcSource } from "./sources";

const accountKey: string = process.env.ACCOUNT!;
const rpcUrl: string = process.env.RPC_URL!;
const grpcUrl: string = process.env.GRPC_URL!;
const grpcToken: string = process.env.GRPC_TOKEN!;

const store: Map<
  number,
  { grpc: number | undefined; jsonrpc: number | undefined; grpcWrites: number; }
> = new Map();

async function main() {
  // process grpc writes
  grpcSource(grpcUrl, grpcToken, accountKey, (slot) => {
    const timestamp = Date.now();
    console.log("grpc   ", slot, timestamp);

    if (store[slot]) {
      // grpc can send multiple writes per slot
      if (store[slot].grpc) {
        store[slot].grpc_writes = store[slot].grpc_writes + 1;
        store[slot].grpc = timestamp;
      } else {
        store[slot].grpc_writes = 1;
        store[slot].grpc = timestamp;
      }
    } else {
      store[slot] = {
        grpc: timestamp,
        grpc_writes: 1,
      };
    }
  });

  // process jsonrpc writes
  jsonrpcSource(rpcUrl, accountKey, (slot) => {
    const timestamp = Date.now();
    console.log("jsonrpc", slot, timestamp);

    if (store[slot]) {
      store[slot].jsonrpc = timestamp;
    } else {
      store[slot] = {
        jsonrpc: timestamp,
      };
    }
  });
}

process.on("SIGINT", function () {
  console.log("slot, grpc_timestamp, jsonrpc_timestamp, delta, grpc_writes");
  Object.entries(store).forEach(([slot, record]) => {
    console.log(
      `${slot}, ${record.grpc}, ${record.jsonrpc}, ${record.grpc - record.jsonrpc}, ${record.grpc_writes}`
    );
  });
  console.log(`done, processed ${Object.keys(store).length} slots`);
  process.exit();
});

main();
