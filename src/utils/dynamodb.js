import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let options = {};

const client = new DynamoDBClient(options);
const documentClient = DynamoDBDocumentClient.from(client)

export default documentClient;
