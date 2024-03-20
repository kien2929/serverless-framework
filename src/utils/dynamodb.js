const AWS = require('aws-sdk')

let options = {}

const client = new AWS.DynamoDB.DocumentClient(options)

module.exports = client
