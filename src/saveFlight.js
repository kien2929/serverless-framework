'use strict';

module.exports.handler = async (event, context, callback) => {
  // const records = {}
  event.Records.forEach(record => {
    const quote = JSON.parse(record.body)
    console.log(1)
    console.log(quote)
    console.log(2)
    console.log(record)
  })
  callback(null)
};
