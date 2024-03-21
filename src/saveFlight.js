"use strict";
const dynamoDb = require("./utils/dynamodb");
const { convertFlightIdentifierToId } = require("./helpers/flight");

module.exports.handler = (event) => {
  const records = {};
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
    const id = convertFlightIdentifierToId(flight.FlightIdentifier);
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

  if (flights.length === 0) return

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
      console.log(err)
    } else {
      console.log(
        `Saved ${params.RequestItems[process.env.DYNAMODB_TABLE].length} to DB.`
      );
    }
  });
};
