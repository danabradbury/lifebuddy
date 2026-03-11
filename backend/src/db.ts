import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const config: DynamoDBClientConfig = {};

export const dynamo = new DynamoDBClient(config);

export const docClient = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
});
