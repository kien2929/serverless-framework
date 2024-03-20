"use strict";
const s3 = require("./utils/s3");
const { success } = require("./utils/response");

module.exports.handler = (event, context, callback) => {
  const records = {};
  const { bucketName, objKey } = event;
  const params = {
    Bucket: bucketName,
    Key: objKey,
  };
  console.log(2)
  return new Promise((resolve) => {
    s3.getObject(params, async (err, data) => {
      if (err) console.log(err, err.stack);
      else {
        const contents = JSON.parse(data.Body);
        console.log(1)
        console.log(contents)
        resolve(contents);
      }
    });
  });
  event.Records.forEach((record) => {
    const body = JSON.parse(record.body);
    const flight = JSON.parse(body);
    const {
      CarrierCode,
      FlightNumber,
      DepartureDate,
      DepartureAirport,
      ArrivalAirport,
      DisruptionType,
      DisruptionCode,
      DisruptionReason,
    } = flight.FlightIdentifier;
    const id = `${CarrierCode}#${FlightNumber}#${DepartureDate}#${DepartureAirport}`;
    if (!records[id]) {
      records[id] = {
        id,
        CarrierCode,
        FlightNumber,
        DepartureDate,
        DepartureAirport,
        ArrivalAirport,
        DisruptionType,
        DisruptionCode,
        DisruptionReason,
      };
    }
  });
  const flights = Object.values(records);

  if (flights.length > 0) {
    const params = {
      RequestItems: {},
    };

    const timestamp = Date.now().toString();

    params.RequestItems[process.env.DYNAMODB_TABLE] = flights.map((flight) => {
      return {
        PutRequest: {
          Item: {
            ...flight,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
      };
    });
    dynamoDb.batchWrite(params, (err, data) => {
      if (err) {
        callback(err);
      } else {
        console.log(
          `Saved ${
            params.RequestItems[process.env.DYNAMODB_TABLE].length
          } to DB.`
        );
        callback(null, success(JSON.stringify(data, null, 2)));
      }
    });
  } else {
    callback(null);
  }
};
