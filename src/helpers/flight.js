module.exports.convertFlightIdentifierToId = (flightIdentifier) => {
  return `${flightIdentifier?.CarrierCode}#${flightIdentifier?.FlightNumber}#${flightIdentifier?.DepartureDate}#${flightIdentifier?.DepartureAirport}`;
};
