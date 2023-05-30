/*
 *
 * This file includes work covered by the following copyright and permission notices:
 *
 * Copyright 2023 Triton One Limited
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { GeyserClient, SubscribeRequest } from "./grpc/geyser";
import { ChannelCredentials, credentials, Metadata } from "@grpc/grpc-js";

export async function grpcSource(
  url: string,
  token: string,
  accountKey: string,
  callback: (slot: number) => void
) {
  const endpointUrl = new URL(url);

  // Open connection
  let creds: ChannelCredentials;
  if (endpointUrl.protocol === "https:") {
    creds = credentials.combineChannelCredentials(
      credentials.createSsl(),
      credentials.createFromMetadataGenerator((_params, callback) => {
        const metadata = new Metadata();
        metadata.add(`x-token`, token);

        return callback(null, metadata);
      })
    );
  } else {
    creds = ChannelCredentials.createInsecure();
  }

  // Create the client
  const client = new GeyserClient(endpointUrl.host, creds);
  const stream = await client.subscribe();

  // Create subscribe request
  const request: SubscribeRequest = {
    accounts: {},
    slots: {},
    transactions: {},
    blocks: {},
    blocksMeta: {},
  };
  request.accounts.client = {
    account: [accountKey],
    owner: [],
    filters: [],
  };

  stream.on('data', (data) => {
    if (data?.account?.slot == undefined) {
      // idk maybe keepalives? happens more on low write load accounts
      return;
    }

    callback(data.account.slot);
  })

  // Send subscribe request
  await new Promise<void>((resolve, reject) => {
    stream.write(request, (err: any) => {
      if (err === null || err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    });
  }).catch((err) => {
    console.error(err);
    throw err;
  });
}

export async function jsonrpcSource(
  url: string,
  accountKey: string,
  callback: (slot: number) => void
) {
  const connection = new Connection(url, "processed");
  connection.onAccountChange(new PublicKey(accountKey), (_, context) => {
    callback(context.slot);
  });
}
