"use strict";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import documentClient from "./utils/dynamodb";
import { convertFlightIdentifierToId } from "./helpers/flight";

export const handler = async (event) => {
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
    throw error;
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

  await documentClient.send(new BatchWriteCommand(params))
  console.log(
    `Saved ${params.RequestItems[process.env.DYNAMODB_TABLE].length} to DB.`
  );
};
