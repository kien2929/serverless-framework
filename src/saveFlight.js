"use strict";
const dynamoDb = require("./utils/dynamodb");
const { convertFlightIdentifierToId } = require("./helpers/flight");

module.exports.handler = async (event) => {
  try {
    const records = event.Records.reduce((accumulator, record) => {
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
      if (!accumulator[id]) {
        accumulator[id] = {
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
      return accumulator
    }, {});

    const flights = Object.values(records);
    if (flights.length === 0) return;

    await saveFlights(flights);
  } catch (error) {
    console.log(error);
  }
};

const saveFlights = async (flights) => {
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

  await dynamoDb.batchWrite(params).promise();
  console.log(
    `Saved ${params.RequestItems[process.env.DYNAMODB_TABLE].length} to DB.`
  );
};
