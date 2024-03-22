"use strict";
import path from "path";
import s3 from"./utils/s3";
import dynamoDb from "./utils/dynamodb";
import { convertFlightIdentifierToId } from "./helpers/flight";

export const handler = async (event) => {
  const bucket = event?.Records[0]?.s3?.bucket?.name;
  const fileKey = event?.Records[0]?.s3?.object?.key;
  try {
    const file = await getFileObject(bucket, fileKey);
    const fileBody = JSON.parse(file.Body);
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

  return s3
    .upload({
      Bucket: bucket,
      Key: `${folderDestination}/${filenameWithoutExtension}-${timestamp}.json`,
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: "application/json",
    })
    .promise();
};

const removeFlights = async (ids) => {
  const params = {
    RequestItems: {
      [process.env.DYNAMODB_TABLE]: ids.map((id) => ({
        DeleteRequest: {
          Key: { id },
        },
      })),
    },
  };
  await dynamoDb.batchWrite(params).promise();
};

const getFileObject = async (bucket, key) => {
  return s3
    .getObject({
      Bucket: bucket,
      Key: key,
    })
    .promise();
};

const moveFileToDestination = async (bucket, sourceKey, newPath) => {
  const filename = path.basename(sourceKey);
  await s3
    .copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: `${newPath}/${filename}`,
    })
    .promise();

  return s3
    .deleteObject({
      Bucket: bucket,
      Key: sourceKey,
    })
    .promise();
};

const getItemByIds = async (ids) => {
  const params = {
    RequestItems: {
      [process.env.DYNAMODB_TABLE]: {
        Keys: ids.map((id) => ({
          id,
        })),
      },
    },
  };
  return await dynamoDb.batchGet(params).promise();
};
