import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export function tables() {
  return {
    submissions: process.env.SUBMISSIONS_TABLE,
    views: process.env.VIEWS_TABLE,
    presence: process.env.PRESENCE_TABLE,
    status: process.env.STATUS_TABLE,
  };
}

export { client, GetCommand, PutCommand, QueryCommand, ScanCommand };
