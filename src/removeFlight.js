"use strict";
import path from "path";
import { BatchWriteCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import {
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import s3Client from "./utils/s3";
import documentClient from "./utils/dynamodb";
import { convertFlightIdentifierToId } from "./helpers/flight";

export const handler = async (event) => {
  const bucket = event?.Records[0]?.s3?.bucket?.name;
  const fileKey = event?.Records[0]?.s3?.object?.key;
  try {
    const fileBodyString = await getFileObjectBodyString(bucket, fileKey);
    const fileBody = JSON.parse(fileBodyString);
    const records = fileBody.Records.map(({ body }) => JSON.parse(body));
    const idsInRecord = records.map(({ FlightIdentifier }) =>
      convertFlightIdentifierToId(FlightIdentifier)
    );

    const itemByIds = await getItemByIds(idsInRecord);

    const idsInDatabase = itemByIds.Responses[process.env.DYNAMODB_TABLE]
      .filter((item) => idsInRecord.includes(item.id))
      .map(({ id }) => id);
    const idsNotInDatabase = idsInRecord.filter(
      (id) => !idsInDatabase.includes(id)
    );

    if (idsInDatabase.length > 0) {
      await Promise.allSettled([
        removeFlights(idsInDatabase),
        moveFileToDestination(bucket, fileKey, "Archived"),
      ]);
    } else {
      await moveFileToDestination(bucket, fileKey, "Error");
    }
    await Promise.allSettled([
      putRecordsToDestination({
        bucket,
        records,
        fileKey,
        ids: idsInDatabase,
        folderDestination: "Processed",
      }),
      putRecordsToDestination({
        bucket,
        records,
        fileKey,
        ids: idsNotInDatabase,
        folderDestination: "UnProcessed",
      }),
    ]);
  } catch (error) {
    console.log(error);
    await moveFileToDestination(bucket, fileKey, "Error");
    throw error;
  }
};

const putRecordsToDestination = async ({
  ids,
  bucket,
  records,
  fileKey,
  folderDestination,
}) => {
  const timestamp = Date.now().toString();
  const filenameWithoutExtension = path.basename(
    fileKey,
    path.extname(fileKey)
  );
  const recordsUpload = records.filter((record) =>
    ids.includes(convertFlightIdentifierToId(record.FlightIdentifier))
  );

  if (recordsUpload.length === 0) return;

  const buffer = Buffer.from(
    JSON.stringify({
      Records: recordsUpload,
    })
  );
  const putObjectCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: `${folderDestination}/${filenameWithoutExtension}-${timestamp}.json`,
    Body: buffer,
    ContentEncoding: "base64",
    ContentType: "application/json",
  });

  return s3Client.send(putObjectCommand);
};

const removeFlights = async (ids) => {
  const command = new BatchWriteCommand({
    RequestItems: {
      [process.env.DYNAMODB_TABLE]: ids.map((id) => ({
        DeleteRequest: {
          Key: { id },
        },
      })),
    },
  });
  await documentClient.send(command);
};

const getFileObjectBodyString = async (bucket, key) => {
  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const file = await s3Client.send(getCommand);

  return file.Body.transformToString()
};

const moveFileToDestination = async (bucket, sourceKey, newPath) => {
  const filename = path.basename(sourceKey);
  const copyCommand = new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: `${newPath}/${filename}`,
  });

  await s3Client.send(copyCommand);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: bucket,
    Key: sourceKey,
  });

  return s3Client.send(deleteCommand);
};

const getItemByIds = async (ids) => {
  const command = new BatchGetCommand({
    RequestItems: {
      [process.env.DYNAMODB_TABLE]: {
        Keys: ids.map((id) => ({
          id,
        })),
      },
    },
  });
  return await documentClient.send(command);
};
